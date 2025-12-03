// ==================== FLIGHT MAP SCRIPT (Intégré à d3js_main.html) ====================
// Ce script doit être ajouté à la fin du fichier d3js_main.html, juste avant </body>

(function() {
  const d3v5 = window.d3; // Utiliser D3 v5 pour la carte (chargé en deuxième)
  
  // 1. CONFIG  
  const mapConfig = {
    colors: {
      outbound: "#667eea",
      inbound: "#764ba2", 
      default: "#94a3b8"
    }
  };

  const mapContainer = document.getElementById("flight-map-container");
  if (!mapContainer) {
    console.error("Container #flight-map-container not found");
    return;
  }
  
  const mapWidth = mapContainer.clientWidth;
  const mapHeight = mapContainer.clientHeight;

  // 2. D3 SETUP
  const mapSvg = d3v5.select("#flight-map-container")
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${mapWidth} ${mapHeight}`);

  const mapProjection = d3v5.geoAlbersUsa()
    .translate([mapWidth / 2, mapHeight / 2])
    .scale(Math.min(mapWidth, mapHeight) * 1.6);

  const mapPath = d3v5.geoPath().projection(mapProjection);

  // Rectangle de fond pour détecter les clics
  mapSvg.insert("rect", ":first-child")
    .attr("class", "map-background")
    .attr("width", mapWidth)
    .attr("height", mapHeight)
    .attr("fill", "transparent")
    .on("click", function() {
      if (d3v5.event.target === this) {
        resetMapView();
      }
    });

  const mapGroup = mapSvg.append("g");
  const gMapStates = mapGroup.append("g").attr("class", "map-states-layer");
  const gMapRoutes = mapGroup.append("g").attr("class", "map-routes-layer");
  const gMapCities = mapGroup.append("g").attr("class", "map-cities-layer");

  // Tooltip
  const mapTooltip = d3v5.select("body")
    .append("div")
    .attr("id", "map-tooltip")
    .style("opacity", 0)
    .style("background-color", "white")
    .style("border", "2px solid #667eea")
    .style("border-radius", "8px")
    .style("padding", "12px 15px")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("z-index", "1000")
    .style("box-shadow", "0 4px 12px rgba(0,0,0,0.15)")
    .style("font-family", "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif")
    .style("font-size", "13px")
    .style("line-height", "1.5");

  // Markers pour les flèches
  const mapDefs = mapSvg.append("defs");
  ['outbound', 'inbound'].forEach(type => {
    mapDefs.append("marker")
      .attr("id", `map-arrow-${type}`)
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 15)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", mapConfig.colors[type]);
  });

  // 4. STATE MANAGEMENT
  const mapState = {
    data: {},
    lookup: {},
    mode: "month",
    timeValue: 1,
    lateFilter: "all",
    selectedCity: null,
    direction: "all"
  };

  // 5. LOAD DATA
  const mapFiles = [
    "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json",
    "../../citiesData/us_cities_from_csv.geojson",
    "../../flightData/dataCredo/aggregated_by_month_and_route.csv",
    "../../flightData/dataCredo/aggregated_by_week_and_route.csv",
    "../../flightData/dataCredo/aggregated_by_late_type_and_route.csv"
  ];

  Promise.all(mapFiles.map((url, i) => i < 2 ? d3v5.json(url) : d3v5.csv(url)))
    .then(function([usMap, cityGeo, monthData, weekData, lateData]) {
      
      // Nettoyer et précalculer les données
      const cleanData = d => ({ ...d, is_late: +d.is_late, flight_number: +d.flight_number });
      monthData = monthData.map(cleanData);
      weekData = weekData.map(cleanData);
      lateData = lateData.map(cleanData);

      // Précalculer par mois
      mapState.dataByMonth = {};
      for (let m = 1; m <= 12; m++) {
        mapState.dataByMonth[m] = monthData.filter(d => d.month == m);
      }

      // Précalculer par semaine
      mapState.dataByWeek = {};
      for (let w = 1; w <= 52; w++) {
        mapState.dataByWeek[w] = weekData.filter(d => d.week_number == w);
      }

      // Précalculer par type de retard
      mapState.dataByLateType = {
        all: lateData,
        bool_carrier_delay_min: lateData.filter(d => d.bool_carrier_delay_min == 1),
        bool_weather_delay_min: lateData.filter(d => d.bool_weather_delay_min == 1),
        bool_traffic_delay_min: lateData.filter(d => d.bool_traffic_delay_min == 1),
        bool_security_delay_min: lateData.filter(d => d.bool_security_delay_min == 1),
        bool_late_aircraft_delay_min: lateData.filter(d => d.bool_late_aircraft_delay_min == 1)
      };

      mapState.data = { month: monthData, week: weekData, late: lateData };

      // Dessiner les états avec projections séparées pour territoires
      const features = topojson.feature(usMap, usMap.objects.states).features;
      const mainland = features.filter(d => d.id !== "02" && d.id !== "15" && d.id !== "72");
      const alaska = features.filter(d => d.id === "02");
      const hawaii = features.filter(d => d.id === "15");
      const puertoRico = features.filter(d => d.id === "72");

      // États continentaux
      gMapStates.selectAll("path.mainland")
        .data(mainland)
        .enter().append("path")
        .attr("class", "mainland")
        .attr("d", mapPath)
        .style("fill", "#e2e8f0")
        .style("stroke", "#fff")
        .style("stroke-width", "1px");

      // Alaska
      const alaskaProjection = d3v5.geoAlbers()
        .rotate([154, 0])
        .center([-2, 64])
        .parallels([55, 65])
        .scale(Math.min(mapWidth, mapHeight) * 0.35)
        .translate([mapWidth * 0.15, mapHeight * 0.85]);
      
      const alaskaPath = d3v5.geoPath().projection(alaskaProjection);
      
      gMapStates.selectAll("path.alaska")
        .data(alaska)
        .enter().append("path")
        .attr("class", "alaska territory-inset")
        .attr("d", alaskaPath)
        .style("fill", "#e2e8f0")
        .style("stroke", "#fff")
        .style("stroke-width", "1px");

      // Hawaii
      const hawaiiProjection = d3v5.geoMercator()
        .center([-157, 20.5])
        .scale(Math.min(mapWidth, mapHeight) * 0.5)
        .translate([mapWidth * 0.35, mapHeight * 0.88]);
      
      const hawaiiPath = d3v5.geoPath().projection(hawaiiProjection);
      
      gMapStates.selectAll("path.hawaii")
        .data(hawaii)
        .enter().append("path")
        .attr("class", "hawaii territory-inset")
        .attr("d", hawaiiPath)
        .style("fill", "#e2e8f0")
        .style("stroke", "#fff")
        .style("stroke-width", "1px");

      // Porto Rico
      const puertoRicoProjection = d3v5.geoMercator()
        .center([-66.5, 18.2])
        .scale(Math.min(mapWidth, mapHeight) * 2)
        .translate([mapWidth * 0.75, mapHeight * 0.88]);
      
      const puertoRicoPath = d3v5.geoPath().projection(puertoRicoProjection);
      
      gMapStates.selectAll("path.puerto-rico")
        .data(puertoRico)
        .enter().append("path")
        .attr("class", "puerto-rico territory-inset")
        .attr("d", puertoRicoPath)
        .style("fill", "#e2e8f0")
        .style("stroke", "#fff")
        .style("stroke-width", "1px");

      // Fonction pour déterminer la projection selon les coordonnées
      function getProjectionForCoords(coords) {
        const [lon, lat] = coords;
        if (lon < -130 && lat > 51) return alaskaProjection;
        else if (lon < -154 && lat < 23 && lat > 18) return hawaiiProjection;
        else if (lon > -68 && lon < -64 && lat > 17 && lat < 19) return puertoRicoProjection;
        return mapProjection;
      }

      // Traiter les villes et précalculer les projections
      cityGeo.features.forEach(f => {
        if(f.geometry && f.geometry.coordinates) {
          const coords = f.geometry.coordinates;
          const cityProjection = getProjectionForCoords(coords);
          mapState.lookup[f.properties.city.trim()] = {
            coords: coords,
            projection: cityProjection,
            projectedCoords: cityProjection(coords)
          };
        }
      });

      // Calculer les statistiques des villes
      const cityCounts = {};
      const cityDepartures = {};
      const cityArrivals = {};
      monthData.forEach(d => {
        cityCounts[d.origin_city] = (cityCounts[d.origin_city] || 0) + (+d.flight_number);
        cityCounts[d.dest_city] = (cityCounts[d.dest_city] || 0) + (+d.flight_number);
        cityDepartures[d.origin_city] = (cityDepartures[d.origin_city] || 0) + (+d.flight_number);
        cityArrivals[d.dest_city] = (cityArrivals[d.dest_city] || 0) + (+d.flight_number);
      });

      mapState.cityStats = { cityCounts, cityDepartures, cityArrivals };

      // Précalculer tous les chemins de routes
      mapState.routePaths = {};
      monthData.forEach(d => {
        const routeKey = `${d.origin_city}-${d.dest_city}`;
        if (mapState.routePaths[routeKey]) return;

        const src = mapState.lookup[d.origin_city];
        const dst = mapState.lookup[d.dest_city];
        if (!src || !dst || !src.projectedCoords || !dst.projectedCoords) return;

        const [x1, y1] = src.projectedCoords;
        const [x2, y2] = dst.projectedCoords;

        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const perpX = -dy / dist;
        const perpY = dx / dist;

        mapState.routePaths[routeKey] = {
          normal: `M${x1},${y1} L${x2},${y2}`,
          outbound: `M${x1 - perpX * 3},${y1 - perpY * 3} L${x2 - perpX * 3},${y2 - perpY * 3}`,
          inbound: `M${x1 + perpX * 3},${y1 + perpY * 3} L${x2 + perpX * 3},${y2 + perpY * 3}`
        };
      });
      
      // Précalculer les tooltips des villes
      mapState.cityTooltips = {};
      Object.keys(mapState.lookup).forEach(cityName => {
        const departures = cityDepartures[cityName] || 0;
        const arrivals = cityArrivals[cityName] || 0;
        const total = cityCounts[cityName] || 0;
        mapState.cityTooltips[cityName] = `
          <div style="font-weight:600; margin-bottom:6px; border-bottom:1px solid #667eea; padding-bottom:4px;">
            ${cityName}
          </div>
          <div style="display:flex; justify-content:space-between; gap:15px; margin-top:4px;">
            <span>Départs:</span> <strong>${departures.toLocaleString()}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; gap:15px;">
            <span>Arrivées:</span> <strong>${arrivals.toLocaleString()}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; gap:15px; margin-top:4px; padding-top:4px; border-top:1px solid #667eea;">
            <span>Total:</span> <strong>${total.toLocaleString()}</strong>
          </div>
        `;
      });

      // Échelles pour la taille et couleur des villes
      const sizeScale = d3v5.scaleSqrt()
        .domain([0, d3v5.max(Object.values(cityCounts))])
        .range([3, 10]);

      const colorScale = d3v5.scaleSequential()
        .domain([0, d3v5.max(Object.values(cityCounts))])
        .interpolator(d3v5.interpolateRgb("#22c55e", "#ef4444"));

      // Dessiner les villes
      gMapCities.selectAll("circle")
        .data(cityGeo.features)
        .enter().append("circle")
        .attr("class", "map-city-node")
        .filter(d => {
          const cityData = mapState.lookup[d.properties.city];
          return cityData && cityData.projectedCoords;
        })
        .attr("r", d => sizeScale(cityCounts[d.properties.city] || 0))
        .attr("fill", d => colorScale(cityCounts[d.properties.city] || 0))
        .style("stroke", "#fff")
        .style("stroke-width", "1px")
        .style("cursor", "pointer")
        .style("transition", "stroke 0.2s")
        .attr("transform", d => {
          const cityData = mapState.lookup[d.properties.city];
          return `translate(${cityData.projectedCoords})`;
        })
        .on("click", d => selectMapCity(d.properties.city))
        .on("mouseover", function(d) {
          const html = mapState.cityTooltips[d.properties.city];
          if (html) showMapTooltip(html, d3v5.event.pageX, d3v5.event.pageY);
          d3v5.select(this).style("stroke", "#000").style("stroke-width", "1.5px");
        })
        .on("mouseout", function(d) {
          hideMapTooltip();
          d3v5.select(this).style("stroke", "#fff").style("stroke-width", "1px");
        });

      // Remplir le sélecteur de villes
      const cityList = Object.keys(mapState.lookup).sort();
      const mapCitySelect = document.getElementById("map-city-search");
      cityList.forEach(city => {
        const option = document.createElement("option");
        option.value = city;
        option.text = city;
        mapCitySelect.appendChild(option);
      });

      updateMapView();
    })
    .catch(error => {
      console.error("Error loading map data:", error);
    });

  // 6. UPDATE MAP
  function updateMapView() {
    let dataset = [];
    if (mapState.mode === "month") {
      dataset = mapState.dataByMonth[mapState.timeValue];
    } else if (mapState.mode === "week") {
      dataset = mapState.dataByWeek[mapState.timeValue];
    } else {
      dataset = mapState.dataByLateType[mapState.lateFilter];
    }

    let displayData = [];

    if (mapState.selectedCity) {
      dataset.forEach(d => {
        const isOut = d.origin_city === mapState.selectedCity;
        const isIn = d.dest_city === mapState.selectedCity;

        if (isOut && (mapState.direction === 'all' || mapState.direction === 'outbound')) {
          d.type = 'outbound';
          displayData.push(d);
        } else if (isIn && (mapState.direction === 'all' || mapState.direction === 'inbound')) {
          d.type = 'inbound';
          displayData.push(d);
        }
      });
    } else {
      displayData = dataset.filter(d => d.flight_number > 0);
      displayData.forEach(d => d.type = 'default');
    }

    const links = gMapRoutes.selectAll("path")
      .data(displayData, d => d.origin_city + "-" + d.dest_city);

    links.exit().remove();

    const enterLinks = links.enter().append("path")
      .attr("fill", "none")
      .attr("stroke-linecap", "round");

    links.merge(enterLinks)
      .attr("class", d => `map-flight-route ${d.type}`)
      .attr("d", d => {
        const routeKey = `${d.origin_city}-${d.dest_city}`;
        const paths = mapState.routePaths[routeKey];
        if (!paths) return null;
        
        if (mapState.selectedCity) {
          return d.type === 'outbound' ? paths.outbound : paths.inbound;
        }
        return paths.normal;
      })
      .attr("stroke", d => {
        if (d.type === 'outbound') return mapConfig.colors.outbound;
        if (d.type === 'inbound') return mapConfig.colors.inbound;
        return mapConfig.colors.default;
      })
      .attr("stroke-width", d => {
        const base = Math.sqrt(d.flight_number);
        return mapState.selectedCity ? Math.max(1.5, base) : Math.max(0.5, base/2);
      })
      .style("opacity", mapState.selectedCity ? 0.8 : 0.15)
      .attr("marker-end", d => {
        if (!mapState.selectedCity) return null;
        return d.type === 'outbound' ? "url(#map-arrow-outbound)" : "url(#map-arrow-inbound)";
      });

    // Délégation d'événements pour les routes
    gMapRoutes.on("mouseover", function(event) {
      const target = event.target;
      if (target.tagName === 'path') {
        const d = d3v5.select(target).datum();
        if (d) {
          d3v5.select(target).attr("stroke-width", 4).attr("stroke", "#333");
          showMapLinkTooltip(d, event.pageX, event.pageY);
        }
      }
    });

    gMapRoutes.on("mouseout", function(event) {
      const target = event.target;
      if (target.tagName === 'path') {
        d3v5.select(target).attr("stroke-width", null).attr("stroke", null);
        hideMapTooltip();
      }
    });

    // Optimisation : Set pour villes connectées
    const connectedCities = new Set();
    if (mapState.selectedCity) {
      displayData.forEach(d => {
        connectedCities.add(d.origin_city);
        connectedCities.add(d.dest_city);
      });
    }

    gMapCities.selectAll("circle")
      .classed("active", d => d.properties.city === mapState.selectedCity)
      .attr("opacity", d => {
        if (!mapState.selectedCity) return 1;
        return connectedCities.has(d.properties.city) || d.properties.city === mapState.selectedCity ? 1 : 0.1;
      });
  }

  // 7. ACTIONS
  function selectMapCity(cityName) {
    mapState.selectedCity = cityName;
    document.getElementById("map-city-search").value = cityName;
    document.getElementById("map-direction-controls").style.display = "flex";
    updateMapView();
  }

  function resetMapView() {
    mapState.selectedCity = null;
    document.getElementById("map-city-search").value = "";
    document.getElementById("map-direction-controls").style.display = "none";
    mapState.direction = 'all';
    const allRadio = document.querySelector('input[name="map-direction"][value="all"]');
    if (allRadio) allRadio.checked = true;
    updateMapView();
  }

  function showMapTooltip(text, x, y) {
    mapTooltip.html(text).style("left", (x+10)+"px").style("top", (y-50)+"px").style("opacity", 1);
  }

  function showMapLinkTooltip(d, x, y) {
    const latePct = d.flight_number > 0 ? ((d.is_late / d.flight_number) * 100).toFixed(1) : 0;
    const html = `
      <div style="font-weight:600; margin-bottom:4px; border-bottom:1px solid #667eea; padding-bottom:4px;">
        ${d.origin_city} ➝ ${d.dest_city}
      </div>
      <div style="display:flex; justify-content:space-between; gap:15px;">
        <span>Total:</span> <strong>${d.flight_number}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; gap:15px;">
        <span>Retard:</span> <strong style="color:${latePct>20?'#f87171':'#4ade80'}">${latePct}%</strong>
      </div>
    `;
    showMapTooltip(html, x, y);
  }

  function hideMapTooltip() {
    mapTooltip.style("opacity", 0);
  }

  // 8. EVENT LISTENERS
  const mapDatasetSelect = document.getElementById("map-dataset-select");
  if (mapDatasetSelect) {
    mapDatasetSelect.addEventListener("change", (e) => {
      mapState.mode = e.target.value;
      const isLate = mapState.mode === "late";
      const timeControls = document.getElementById("map-time-controls");
      const lateControls = document.getElementById("map-late-controls");
      
      if (timeControls) timeControls.style.display = isLate ? "none" : "flex";
      if (lateControls) lateControls.style.display = isLate ? "flex" : "none";

      if (mapState.mode === "month") {
        const timeLabel = document.getElementById("map-time-label");
        const slider = document.getElementById("map-time-slider");
        const display = document.getElementById("map-time-display");
        
        if (timeLabel) timeLabel.textContent = "Mois :";
        if (slider) {
          slider.max = 12;
          slider.value = 1;
        }
        mapState.timeValue = 1;
        if (display) display.textContent = "Janvier";
      } else if (mapState.mode === "week") {
        const timeLabel = document.getElementById("map-time-label");
        const slider = document.getElementById("map-time-slider");
        const display = document.getElementById("map-time-display");
        
        if (timeLabel) timeLabel.textContent = "Semaine :";
        if (slider) {
          slider.max = 52;
          slider.value = 1;
        }
        mapState.timeValue = 1;
        if (display) display.textContent = "Semaine 1";
      }
      updateMapView();
    });
  }

  const mapTimeSlider = document.getElementById("map-time-slider");
  if (mapTimeSlider) {
    mapTimeSlider.addEventListener("input", (e) => {
      mapState.timeValue = +e.target.value;
      const display = document.getElementById("map-time-display");
      if (display) {
        if (mapState.mode === "month") {
          const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", 
                              "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
          display.textContent = monthNames[mapState.timeValue - 1];
        } else {
          display.textContent = "Semaine " + mapState.timeValue;
        }
      }
      updateMapView();
    });
  }

  const mapDelaySelect = document.getElementById("map-delay-select");
  if (mapDelaySelect) {
    mapDelaySelect.addEventListener("change", (e) => {
      mapState.lateFilter = e.target.value;
      updateMapView();
    });
  }

  const mapCitySearch = document.getElementById("map-city-search");
  if (mapCitySearch) {
    mapCitySearch.addEventListener("change", (e) => {
      if(e.target.value) selectMapCity(e.target.value);
      else resetMapView();
    });
  }

  const mapResetBtn = document.getElementById("map-reset-btn");
  if (mapResetBtn) {
    mapResetBtn.addEventListener("click", resetMapView);
  }

  document.querySelectorAll('input[name="map-direction"]').forEach(radio => {
    radio.addEventListener("change", (e) => {
      mapState.direction = e.target.value;
      updateMapView();
    });
  });
})();

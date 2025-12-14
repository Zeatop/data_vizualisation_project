// set the dimensions and margins of the graph
const margin = {top: 80, right: 30, bottom: 50, left: 60},
    width = (window.innerWidth * 0.85) / 2 - margin.left - margin.right,
    height = 500 - margin.top - margin.bottom

// append the svg objects to the body of the page
const svgOrigin = d3.select("#streamchart-origin")
  .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform",
          `translate(${margin.left}, ${margin.top})`);

const svgDest = d3.select("#streamchart-dest")
  .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform",
          `translate(${margin.left}, ${margin.top})`);

// Variables globales pour stocker les données et le sélecteur
let allDataMonthOrigin = [];
let allDataWeekOrigin = [];
let allDataMonthDest = [];
let allDataWeekDest = [];
let currentCity = "";
let currentMode = "count";
let currentPeriod = "month";
let showOnTime = true;
let activeDelayTypes = {
  'bool_carrier_delay_min': true,
  'bool_weather_delay_min': true,
  'bool_traffic_delay_min': true,
  'bool_security_delay_min': true,
  'bool_late_aircraft_delay_min': true,
  'on_time_flights': false
};

// Fonction pour dessiner le streamchart
function drawStreamchart(selectedCity, viewMode = "count", timePeriod = "month", includeOnTime = true, svg, allData, cityColumn, chartTitle) {
  
  // Nettoyer le SVG (sauf les axes et le titre qu'on va recréer)
  svg.selectAll("*").remove();

  // Filtrer pour la ville sélectionnée (ou toutes les villes si 'All')
  let data = selectedCity === "All" 
    ? allData 
    : allData.filter(d => d[cityColumn] === selectedCity);

  if (data.length === 0) {
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .style("font-size", "18px")
      .text("Aucune donnée disponible pour cette ville");
    return;
  }

  // Ajouter un titre
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", -30)
    .attr("text-anchor", "middle")
    .style("font-size", "18px")
    .style("font-weight", "600")
    .style("fill", "#333")
    .text(chartTitle);
    
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", -10)
    .attr("text-anchor", "middle")
    .style("font-size", "14px")
    .style("fill", "#666")
    .text(selectedCity === "All" ? "Toutes les villes" : `${selectedCity}`);

  // List of groups = les colonnes de types de retard (pas les colonnes de groupement)
  const allKeys = ['bool_carrier_delay_min', 'bool_weather_delay_min', 'bool_traffic_delay_min', 
                'bool_security_delay_min', 'bool_late_aircraft_delay_min', 'on_time_flights'];
  
  // Filtrer les clés selon les types actifs et la checkbox "vols à l'heure"
  const keys = allKeys.filter(key => {
    if (key === 'on_time_flights') {
      return includeOnTime && activeDelayTypes[key];
    }
    return activeDelayTypes[key];
  });

  // Si 'All' est sélectionné, agréger les données par période
  if (selectedCity === "All") {
    const aggregatedData = {};
    
    data.forEach(function(d) {
      const timeKey = timePeriod === "month" ? +d.month : +d.week_number;
      
      if (!aggregatedData[timeKey]) {
        aggregatedData[timeKey] = {
          timeValue: timeKey,
          flight_number: 0,
          is_late: 0,
          bool_carrier_delay_min: 0,
          bool_weather_delay_min: 0,
          bool_traffic_delay_min: 0,
          bool_security_delay_min: 0,
          bool_late_aircraft_delay_min: 0
        };
      }
      
      aggregatedData[timeKey].flight_number += +d.flight_number;
      aggregatedData[timeKey].is_late += +d.is_late;
      aggregatedData[timeKey].bool_carrier_delay_min += +d.bool_carrier_delay_min;
      aggregatedData[timeKey].bool_weather_delay_min += +d.bool_weather_delay_min;
      aggregatedData[timeKey].bool_traffic_delay_min += +d.bool_traffic_delay_min;
      aggregatedData[timeKey].bool_security_delay_min += +d.bool_security_delay_min;
      aggregatedData[timeKey].bool_late_aircraft_delay_min += +d.bool_late_aircraft_delay_min;
    });
    
    data = Object.values(aggregatedData).sort((a, b) => a.timeValue - b.timeValue);
  }
  
  // Convertir toutes les valeurs en nombres et calculer les pourcentages si nécessaire
  data.forEach(function(d) {
    // Utiliser month ou week_number selon la période
    if (timePeriod === "month") {
      d.month = +d.month;
      d.timeValue = d.timeValue || d.month;
    } else {
      d.week_number = +d.week_number;
      d.timeValue = d.timeValue || d.week_number;
    }
    d.flight_number = +d.flight_number;
    d.is_late = +d.is_late;
    
    // Calculer les vols à l'heure (total - retards)
    d.on_time_flights = d.flight_number - d.is_late;
    
    keys.forEach(function(key) {
      if (key !== 'on_time_flights') {
        d[key] = +d[key];  // Convertit en nombre
      }
      
      // Si mode pourcentage, calculer le pourcentage
      if (viewMode === "percentage" && d.flight_number > 0) {
        d[key + "_pct"] = (d[key] / d.flight_number) * 100;
      }
    });
  });

  // Utiliser les bonnes clés selon le mode
  const dataKeys = viewMode === "percentage" 
    ? keys.map(k => k + "_pct")
    : keys;

  // Add X axis avec domaine adapté à la période
  const xDomain = timePeriod === "month" ? [1, 12] : [1, 53];
  const xTickValues = timePeriod === "month" 
    ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    : [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 53];
  
  const x = d3.scaleLinear()
    .domain(xDomain)
    .range([ 0, width ]);
  svg.append("g")
    .attr("transform", `translate(0, ${height*0.85})`)
    .call(d3.axisBottom(x).tickSize(-height*.75).tickValues(xTickValues))
    .select(".domain").remove()
  // Customization
  svg.selectAll(".tick line").attr("stroke", "#e0e0e0").attr("opacity", 0.7)
  svg.selectAll(".tick text").attr("fill", "#666").style("font-size", "12px")

  // Add X axis label:
  svg.append("text")
      .attr("text-anchor", "end")
      .attr("x", width)
      .attr("y", height + 15)
      .style("fill", "#666")
      .style("font-size", "13px")
      .style("font-weight", "500")
      .text(timePeriod === "month" ? "Temps (mois)" : "Temps (semaines)");

  // Stack the data first to calculate proper Y domain
  const tempStackedData = d3.stack()
    .offset(d3.stackOffsetSilhouette)
    .keys(dataKeys)
    (data);
  
  // Calculate Y domain based on actual data with padding
  const yExtent = d3.extent(tempStackedData.flat(2));
  const yPadding = (yExtent[1] - yExtent[0]) * 0.3; // 30% padding
  
  // Add Y axis
  const y = d3.scaleLinear()
    .domain([yExtent[0] - yPadding, yExtent[1] + yPadding])
    .range([ height, 0 ]);

  // Mapping fixe des couleurs pour chaque type de retard
  const colorMapping = {
    'bool_carrier_delay_min': '#1b9e77',
    'bool_weather_delay_min': '#d95f02',
    'bool_traffic_delay_min': '#7570b3',
    'bool_security_delay_min': '#e7298a',
    'bool_late_aircraft_delay_min': '#66a61e',
    'on_time_flights': '#e6ab02',
    'bool_carrier_delay_min_pct': '#1b9e77',
    'bool_weather_delay_min_pct': '#d95f02',
    'bool_traffic_delay_min_pct': '#7570b3',
    'bool_security_delay_min_pct': '#e7298a',
    'bool_late_aircraft_delay_min_pct': '#66a61e',
    'on_time_flights_pct': '#e6ab02'
  };
  
  // color palette avec mapping fixe
  const color = function(key) {
    return colorMapping[key] || '#999999';
  };

  //stack the data?
  const stackedData = d3.stack()
    .offset(d3.stackOffsetSilhouette)
    .keys(dataKeys)
    (data)

  // create a tooltip
  const tooltipId = "tooltip-" + Math.random().toString(36).substr(2, 9);
  const Tooltip = d3.select("body")
    .append("div")
    .attr("id", tooltipId)
    .style("opacity", 0)
    .attr("class", "tooltip")
    .style("background-color", "white")
    .style("border", "2px solid #667eea")
    .style("border-radius", "8px")
    .style("padding", "12px 15px")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("z-index", "1000")
    .style("box-shadow", "0 4px 12px rgba(0,0,0,0.15)")

  // Mapping des noms lisibles
  const delayNames = {
    'bool_carrier_delay_min': 'Retard Compagnie',
    'bool_weather_delay_min': 'Retard Météo',
    'bool_traffic_delay_min': 'Retard Trafic',
    'bool_security_delay_min': 'Retard Sécurité',
    'bool_late_aircraft_delay_min': 'Retard Avion Précédent',
    'on_time_flights': 'Vols ponctuels',
    'bool_carrier_delay_min_pct': 'Retard Compagnie',
    'bool_weather_delay_min_pct': 'Retard Météo',
    'bool_traffic_delay_min_pct': 'Retard Trafic',
    'bool_security_delay_min_pct': 'Retard Sécurité',
    'bool_late_aircraft_delay_min_pct': 'Retard Avion Précédent',
    'on_time_flights_pct': 'Vols ponctuels'
  };

  // Three function that change the tooltip when user hover / move / leave a cell
  const mouseover = function(event,d) {
    Tooltip.style("opacity", 1)
    d3.selectAll(".myArea").style("opacity", .2)
    d3.select(this)
      .style("stroke", "black")
      .style("opacity", 1)
  }
  const mousemove = function(event,d) {
    // Trouver la période la plus proche (mois ou semaine)
    const mouseX = d3.pointer(event)[0];
    const timeValue = Math.round(x.invert(mouseX));
    const timeData = d.find(point => point.data.timeValue === timeValue);
    
    if (timeData) {
      const delayType = delayNames[d.key];
      const value = timeData.data[d.key];
      const displayValue = viewMode === "percentage" 
        ? value.toFixed(1) + "%" 
        : Math.round(value);
      
      const timeLabel = timePeriod === "month" ? "Mois" : "Semaine";
      
      Tooltip
        .html(`<strong>${delayType}</strong><br/>${timeLabel}: ${timeValue}<br/>${viewMode === "percentage" ? "Taux" : "Nombre de vols"}: ${displayValue}`)
        .style("left", (event.pageX + 15) + "px")
        .style("top", (event.pageY - 28) + "px")
    }
  }
  const mouseleave = function(event,d) {
    Tooltip.style("opacity", 0)
    d3.selectAll(".myArea").style("opacity", 1).style("stroke", "none")
  }

  // Area generator
  const area = d3.area()
    .x(function(d) { return x(d.data.timeValue); })
    .y0(function(d) { return y(d[0]); })
    .y1(function(d) { return y(d[1]); })
    .curve(d3.curveCatmullRom.alpha(0.5))

  // Show the areas
  svg
    .selectAll("mylayers")
    .data(stackedData)
    .join("path")
      .attr("class", "myArea")
      .style("fill", function(d) { return color(d.key); })
      .attr("d", area)
      .on("mouseover", mouseover)
      .on("mousemove", mousemove)
      .on("mouseleave", mouseleave)
}

// Charger les quatre datasets CSV
Promise.all([
  d3.csv("../../../flightData/dataLeo/aggregated_by_month_and_origin_city.csv"),
  d3.csv("../../../flightData/dataLeo/aggregated_by_week_and_origin_city.csv"),
  d3.csv("../../../flightData/dataLeo/aggregated_by_month_and_dest_city.csv"),
  d3.csv("../../../flightData/dataLeo/aggregated_by_week_and_dest_city.csv")
]).then(function([dataMonthOrigin, dataWeekOrigin, dataMonthDest, dataWeekDest]) {
  allDataMonthOrigin = dataMonthOrigin;
  allDataWeekOrigin = dataWeekOrigin;
  allDataMonthDest = dataMonthDest;
  allDataWeekDest = dataWeekDest;

  // Extraire la liste unique des villes (depuis les données mensuelles d'origine)
  const cities = [...new Set(dataMonthOrigin.map(d => d.origin_city))].sort();

  // Fonction pour redessiner les deux graphiques
  function updateCharts(selectedCity, viewMode, timePeriod) {
    currentCity = selectedCity;
    currentMode = viewMode;
    currentPeriod = timePeriod;
    const includeOnTime = activeDelayTypes['on_time_flights'];
    
    // Sélectionner les bons datasets
    const dataOrigin = timePeriod === "month" ? allDataMonthOrigin : allDataWeekOrigin;
    const dataDest = timePeriod === "month" ? allDataMonthDest : allDataWeekDest;
    
    // Dessiner les deux graphiques
    drawStreamchart(selectedCity, viewMode, timePeriod, includeOnTime, svgOrigin, dataOrigin, "origin_city", "Vols au départ");
    drawStreamchart(selectedCity, viewMode, timePeriod, includeOnTime, svgDest, dataDest, "dest_city", "Vols à l'arrivée");
  }

  // Dessiner les graphiques initiaux avec valeurs par défaut
  updateCharts("All", "count", "month");

  // Envoyer la liste des villes au parent
  window.parent.postMessage({
    type: 'citiesLoaded',
    cities: cities
  }, '*');

  // Écouter les messages du parent pour mettre à jour les graphiques
  window.addEventListener('message', function(event) {
    if (event.data.type === 'updateStreamchart') {
      updateCharts(event.data.city, event.data.mode, event.data.period);
    }
    
    if (event.data.type === 'updateDelayFilters') {
      // Convertir le format du parent vers le format du streamchart
      const filters = event.data.enabledDelayTypes;
      activeDelayTypes = {
        'bool_carrier_delay_min': filters.carrier,
        'bool_weather_delay_min': filters.weather,
        'bool_traffic_delay_min': filters.traffic,
        'bool_security_delay_min': filters.security,
        'bool_late_aircraft_delay_min': filters.late_aircraft,
        'on_time_flights': filters.ontime
      };
      
      // Redessiner avec les paramètres actuels
      updateCharts(currentCity || "All", currentMode || "count", currentPeriod || "month");
    }
  });
  
  // Écouter les changements des checkboxes de la légende (si elles existent localement)
  d3.selectAll('.legend-item input[type="checkbox"]').on("change", function() {
    const legendItem = d3.select(this.parentNode);
    const key = legendItem.attr('data-key');
    const checked = d3.select(this).property("checked");
    
    // Mettre à jour l'état actif
    activeDelayTypes[key] = checked;
    
    // Style visuel pour indiquer l'état
    legendItem.style('opacity', checked ? '1' : '0.5');
    
    // Redessiner avec les paramètres actuels
    updateCharts(currentCity || "All", currentMode || "count", currentPeriod || "month");
  });
});

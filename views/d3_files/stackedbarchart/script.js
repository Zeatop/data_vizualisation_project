// Configuration des types de retard avec couleurs cohérentes
const delayTypeConfig = {
    ontime: { label: 'À l\'heure', color: '#e6ab02' },
    carrier: { label: 'Retard compagnie', color: '#1b9e77' },
    weather: { label: 'Retard météo', color: '#d95f02' },
    traffic: { label: 'Retard trafic', color: '#7570b3' },
    security: { label: 'Retard sécurité', color: '#e7298a' },
    late_aircraft: { label: 'Retard avion', color: '#66a61e' }
};

// Configuration globale
const margin = { top: 20, right: 40, bottom: 120, left: 80 };
let width, height;
let svg, xScale, yScale, colorScale;

// Données
let dataByMonth = new Map();
let dataByWeek = new Map();
let currentPeriod = 'month';
let currentTimeValue = 1;
let currentMode = 'count';

// Filtres des types de retard
let enabledDelayTypes = {
    carrier: true,
    weather: true,
    traffic: true,
    security: true,
    late_aircraft: true,
    ontime: false
};

// Initialisation
function init() {
    setupSVG();
    loadData();
    setupMessageListener();
}

// Configuration du SVG
function setupSVG() {
    const container = document.getElementById('chart-container');
    const rect = container.getBoundingClientRect();
    width = Math.max(800, rect.width - margin.left - margin.right);
    height = Math.max(450, rect.height - margin.top - margin.bottom);

    svg = d3.select('#stacked-bar-chart')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Axes placeholders
    svg.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${height})`);

    svg.append('g')
        .attr('class', 'y-axis');

    // Labels des axes
    svg.append('text')
        .attr('class', 'x-axis-label')
        .attr('text-anchor', 'middle')
        .attr('x', width / 2)
        .attr('y', height + 75)
        .text('Compagnies aériennes');

    svg.append('text')
        .attr('class', 'y-axis-label')
        .attr('text-anchor', 'middle')
        .attr('transform', 'rotate(-90)')
        .attr('y', -45)
        .attr('x', -height / 2)
        .text('Nombre de vols');
}

// Chargement des données
async function loadData() {
    try {
        const [monthData, weekData] = await Promise.all([
            d3.csv('../../../flightData/dataKhadija/aggregated_by_month_and_carrier.csv'),
            d3.csv('../../../flightData/dataKhadija/aggregated_by_week_and_carrier.csv')
        ]);

        // Traiter les données par mois
        const monthGroups = d3.group(monthData, d => +d.month);
        monthGroups.forEach((rows, month) => {
            dataByMonth.set(month, processCarrierData(rows));
        });

        // Traiter les données par semaine
        const weekGroups = d3.group(weekData, d => +d.week);
        weekGroups.forEach((rows, week) => {
            dataByWeek.set(week, processCarrierData(rows));
        });

        updateChart();
    } catch (error) {
        console.error('Erreur de chargement des données:', error);
    }
}

// Traiter les données par compagnie
function processCarrierData(rows) {
    const carrierMap = new Map();

    rows.forEach(row => {
        const carrier = row.carrier_name;
        const totalFlights = +row.flight_number || 0;
        const lateFlights = +row.is_late || 0;
        const ontimeFlights = totalFlights - lateFlights;
        
        // Les colonnes bool_* contiennent déjà les nombres de vols avec chaque type de retard
        const carrierDelay = +row.bool_carrier_delay_min || 0;
        const weatherDelay = +row.bool_weather_delay_min || 0;
        const trafficDelay = +row.bool_traffic_delay_min || 0;
        const securityDelay = +row.bool_security_delay_min || 0;
        const lateAircraftDelay = +row.bool_late_aircraft_delay_min || 0;
        
        if (!carrierMap.has(carrier)) {
            carrierMap.set(carrier, {
                carrier: carrier,
                ontime: 0,
                carrier_delay: 0,
                weather_delay: 0,
                traffic_delay: 0,
                security_delay: 0,
                late_aircraft_delay: 0,
                total: 0
            });
        }

        const carrierData = carrierMap.get(carrier);
        carrierData.total += totalFlights;
        carrierData.ontime += ontimeFlights;
        carrierData.carrier_delay += carrierDelay;
        carrierData.weather_delay += weatherDelay;
        carrierData.traffic_delay += trafficDelay;
        carrierData.security_delay += securityDelay;
        carrierData.late_aircraft_delay += lateAircraftDelay;
    });

    // Convertir en tableau et trier par nombre total de vols
    const result = Array.from(carrierMap.values())
        .sort((a, b) => b.total - a.total);
    
    // Ajouter les versions en pourcentage pour chaque entrée
    result.forEach(d => {
        if (d.total > 0) {
            d.ontime_pct = (d.ontime / d.total) * 100;
            d.carrier_delay_pct = (d.carrier_delay / d.total) * 100;
            d.weather_delay_pct = (d.weather_delay / d.total) * 100;
            d.traffic_delay_pct = (d.traffic_delay / d.total) * 100;
            d.security_delay_pct = (d.security_delay / d.total) * 100;
            d.late_aircraft_delay_pct = (d.late_aircraft_delay / d.total) * 100;
        } else {
            d.ontime_pct = 0;
            d.carrier_delay_pct = 0;
            d.weather_delay_pct = 0;
            d.traffic_delay_pct = 0;
            d.security_delay_pct = 0;
            d.late_aircraft_delay_pct = 0;
        }
    });
    
    return result;
}

// Mise à jour du graphique
function updateChart() {
    let data = currentPeriod === 'month' 
        ? dataByMonth.get(currentTimeValue)
        : dataByWeek.get(currentTimeValue);

    if (!data || data.length === 0) {
        console.warn('Pas de données pour', currentPeriod, currentTimeValue);
        return;
    }

    // Préparer les données pour le stack - filtrer selon les types activés
    const baseKeys = ['ontime', 'carrier_delay', 'weather_delay', 'traffic_delay', 'security_delay', 'late_aircraft_delay'];
    const keyMapping = {
        'carrier_delay': 'carrier',
        'weather_delay': 'weather',
        'traffic_delay': 'traffic',
        'security_delay': 'security',
        'late_aircraft_delay': 'late_aircraft',
        'ontime': 'ontime'
    };
    
    // Filtrer les clés selon les types activés
    const activeBaseKeys = baseKeys.filter(key => {
        const mappedKey = keyMapping[key];
        return enabledDelayTypes[mappedKey] === true;
    });
    
    if (activeBaseKeys.length === 0) {
        console.warn('Aucun type de retard activé');
        svg.selectAll('.bar-group').remove();
        return;
    }
    
    // Utiliser les bonnes clés selon le mode (avec ou sans _pct)
    const keys = currentMode === 'percentage'
        ? activeBaseKeys.map(k => k + '_pct')
        : activeBaseKeys;
    
    const stackedData = d3.stack()
        .keys(keys)
        (data);

    // Calculer le max pour l'échelle Y
    const maxY = d3.max(data, d => {
        return keys.reduce((sum, key) => sum + (d[key] || 0), 0);
    });

    // Échelles
    xScale = d3.scaleBand()
        .domain(data.map(d => d.carrier))
        .range([0, width])
        .padding(0.2);

    // Adapter l'échelle Y selon le mode
    if (currentMode === 'percentage') {
        yScale = d3.scaleLinear()
            .domain([0, 100])
            .range([height, 0]);
    } else {
        yScale = d3.scaleLinear()
            .domain([0, maxY])
            .nice()
            .range([height, 0]);
    }

    // Créer un mapping couleur basé sur les keys (avec et sans _pct)
    const colorMapping = {
        'ontime': delayTypeConfig.ontime.color,
        'carrier_delay': delayTypeConfig.carrier.color,
        'weather_delay': delayTypeConfig.weather.color,
        'traffic_delay': delayTypeConfig.traffic.color,
        'security_delay': delayTypeConfig.security.color,
        'late_aircraft_delay': delayTypeConfig.late_aircraft.color,
        'ontime_pct': delayTypeConfig.ontime.color,
        'carrier_delay_pct': delayTypeConfig.carrier.color,
        'weather_delay_pct': delayTypeConfig.weather.color,
        'traffic_delay_pct': delayTypeConfig.traffic.color,
        'security_delay_pct': delayTypeConfig.security.color,
        'late_aircraft_delay_pct': delayTypeConfig.late_aircraft.color
    };
    
    colorScale = d3.scaleOrdinal()
        .domain(keys)
        .range(keys.map(key => colorMapping[key]));

    // Mise à jour des axes
    svg.select('.x-axis')
        .transition()
        .duration(750)
        .call(d3.axisBottom(xScale))
        .selectAll('text')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end');

    svg.select('.y-axis')
        .transition()
        .duration(750)
        .call(d3.axisLeft(yScale).ticks(5));

    // Mettre à jour le label de l'axe Y
    const yLabel = currentMode === 'percentage' 
        ? 'Pourcentage de vols (%)' 
        : 'Nombre de vols';
    svg.select('.y-axis-label').text(yLabel);

    // Dessiner les barres empilées
    const groups = svg.selectAll('.bar-group')
        .data(stackedData, d => d.key);

    groups.exit().remove();

    const groupsEnter = groups.enter()
        .append('g')
        .attr('class', 'bar-group')
        .attr('fill', d => colorScale(d.key));

    const allGroups = groupsEnter.merge(groups);

    // Dessiner les segments de barres
    const rects = allGroups.selectAll('rect')
        .data(d => d, d => d.data.carrier);

    rects.exit()
        .transition()
        .duration(500)
        .attr('height', 0)
        .attr('y', height)
        .remove();

    const rectsEnter = rects.enter()
        .append('rect')
        .attr('class', 'bar-segment')
        .attr('x', d => xScale(d.carrier))
        .attr('width', xScale.bandwidth())
        .attr('y', height)
        .attr('height', 0);

    rectsEnter.merge(rects)
        .on('mouseover', function(event, d) {
            const key = d3.select(this.parentNode).datum().key;
            const value = d[1] - d[0];
            const carrier = d.data.carrier;
            
            // Extraire la clé de base (sans _pct)
            const baseKey = key.replace('_pct', '');
            
            let label;
            if (baseKey === 'ontime') label = delayTypeConfig.ontime.label;
            else if (baseKey === 'carrier_delay') label = delayTypeConfig.carrier.label;
            else if (baseKey === 'weather_delay') label = delayTypeConfig.weather.label;
            else if (baseKey === 'traffic_delay') label = delayTypeConfig.traffic.label;
            else if (baseKey === 'security_delay') label = delayTypeConfig.security.label;
            else if (baseKey === 'late_aircraft_delay') label = delayTypeConfig.late_aircraft.label;

            const tooltip = d3.select('#tooltip');
            
            // Adapter le contenu selon le mode
            if (currentMode === 'percentage') {
                // Récupérer la valeur originale (nombre de vols)
                const originalValue = d.data[baseKey] || 0;
                
                tooltip.html(`
                    <strong>${carrier}</strong><br>
                    ${label}: ${value.toFixed(1)}%<br>
                    <small>(${originalValue.toLocaleString('fr-FR')} vols sur ${d.data.total.toLocaleString('fr-FR')} au total)</small>
                `);
            } else {
                tooltip.html(`
                    <strong>${carrier}</strong><br>
                    ${label}: ${value.toLocaleString('fr-FR')} vols<br>
                    Total: ${d.data.total.toLocaleString('fr-FR')} vols
                `);
            }
            
            tooltip.classed('visible', true);
            moveTooltip(event);
        })
        .on('mousemove', moveTooltip)
        .on('mouseout', hideTooltip)
        .transition()
        .duration(750)
        .attr('x', d => xScale(d.data.carrier))
        .attr('width', xScale.bandwidth())
        .attr('y', d => yScale(d[1]))
        .attr('height', d => yScale(d[0]) - yScale(d[1]));
}

// Gestion du tooltip
function moveTooltip(event) {
    const tooltip = document.getElementById('tooltip');
    const tooltipRect = tooltip.getBoundingClientRect();
    
    let x = event.clientX + 15;
    let y = event.clientY + 15;
    
    // Vérifier les limites de la fenêtre
    if (x + tooltipRect.width > window.innerWidth) {
        x = event.clientX - tooltipRect.width - 15;
    }
    if (y + tooltipRect.height > window.innerHeight) {
        y = event.clientY - tooltipRect.height - 15;
    }
    
    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
}

function hideTooltip() {
    d3.select('#tooltip').classed('visible', false);
}

// Écouter les messages du parent
function setupMessageListener() {
    window.addEventListener('message', function(event) {
        if (event.data.type === 'updateStackedBarChart') {
            const { period, timeValue, mode } = event.data;
            
            if (period) currentPeriod = period;
            if (timeValue !== undefined) currentTimeValue = +timeValue; // Convertir en nombre
            if (mode) currentMode = mode;
            
            updateChart();
        }
        
        if (event.data.type === 'updateDelayFilters') {
            enabledDelayTypes = event.data.enabledDelayTypes;
            updateChart();
        }
    });
}

// Initialiser au chargement
window.addEventListener('load', init);

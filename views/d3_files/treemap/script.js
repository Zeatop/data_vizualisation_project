// ============================================================================
// TREEMAP - ANALYSE DES VOLS PAR CATÉGORIE DE DISTANCE
// ============================================================================

// 1. CONFIGURATION
const config = {
    colors: {
        carrier: "#1b9e77",         // Retard Compagnie
        weather: "#d95f02",         // Retard Météo
        traffic: "#7570b3",         // Retard Trafic
        security: "#e7298a",        // Retard Sécurité
        late_aircraft: "#66a61e",   // Retard Avion Précédent
        ontime: "#10b981"           // Vert pour à l'heure
    },
    delayTypes: [
        { key: 'bool_carrier_delay_min', name: 'Retard Compagnie', color: 'carrier' },
        { key: 'bool_weather_delay_min', name: 'Retard Météo', color: 'weather' },
        { key: 'bool_traffic_delay_min', name: 'Retard Trafic', color: 'traffic' },
        { key: 'bool_security_delay_min', name: 'Retard Sécurité', color: 'security' },
        { key: 'bool_late_aircraft_delay_min', name: 'Retard Avion Précédent', color: 'late_aircraft' }
    ],
    margin: { top: 10, right: 10, bottom: 20, left: 10 }
};

// 2. DIMENSIONS
const container = document.getElementById("treemap-container");
const width = container.clientWidth - config.margin.left - config.margin.right;
const height = container.clientHeight - config.margin.top - config.margin.bottom;

// 3. SVG SETUP
const svg = d3.select("#treemap-svg")
    .attr("viewBox", `0 0 ${width + config.margin.left + config.margin.right} ${height + config.margin.top + config.margin.bottom}`)
    .append("g")
    .attr("transform", `translate(${config.margin.left},${config.margin.top})`);

const tooltip = d3.select("#tooltip");

// 4. STATE MANAGEMENT
const state = {
    period: "month",  // month | week
    month: 1,
    week: 1,
    data: null,
    processedData: null
};

// 5. CHARGEMENT DES DONNÉES
Promise.all([
    d3.csv("../../../flightData/dataDelphine/aggregated_by_month_and_distance_category.csv"),
    d3.csv("../../../flightData/dataDelphine/aggregated_by_week_and_distance_category.csv")
]).then(function([monthData, weekData]) {
    
    // Nettoyer et convertir les données
    const cleanData = d => ({
        ...d,
        month: +d.month || null,
        week_number: +d.week_number || null,
        is_late: +d.is_late,
        flight_number: +d.flight_number,
        cancelled: +d.cancelled,
        distance_category: d.distance_category,
        bool_carrier_delay_min: +d.bool_carrier_delay_min || 0,
        bool_weather_delay_min: +d.bool_weather_delay_min || 0,
        bool_traffic_delay_min: +d.bool_traffic_delay_min || 0,
        bool_security_delay_min: +d.bool_security_delay_min || 0,
        bool_late_aircraft_delay_min: +d.bool_late_aircraft_delay_min || 0
    });
    
    state.dataByMonth = d3.group(monthData.map(cleanData), d => d.month);
    state.dataByWeek = d3.group(weekData.map(cleanData), d => d.week_number);
    
    // Initialiser la visualisation
    updateTreemap();
    
    // Écouter les messages du parent
    window.addEventListener('message', function(event) {
        if (event.data.type === 'updateTreemap') {
            const { period, timeValue } = event.data;
            
            if (period) {
                state.period = period;
            }
            
            if (timeValue !== undefined) {
                const value = +timeValue;
                
                if (period === 'month' || state.period === 'month') {
                    state.month = value;
                } else {
                    state.week = value;
                }
            }
            
            updateTreemap();
        }
    });
    
}).catch(err => {
    console.error("Erreur lors du chargement des données:", err);
});

// 6. FONCTION DE MISE À JOUR DE LA TREEMAP
function updateTreemap() {
    // Récupérer les données selon la période
    let dataset;
    if (state.period === "month") {
        dataset = state.dataByMonth.get(state.month) || [];
    } else {
        dataset = state.dataByWeek.get(state.week) || [];
    }
    
    if (!dataset || dataset.length === 0) {
        console.warn("Pas de données pour cette période");
        return;
    }
    
    // Préparer les données hiérarchiques
    const hierarchyData = prepareHierarchyData(dataset);
    
    // Créer la hiérarchie D3
    const root = d3.hierarchy(hierarchyData)
        .sum(d => d.value)
        .sort((a, b) => b.value - a.value);
    
    // Créer le layout treemap
    d3.treemap()
        .size([width, height])
        .padding(2)
        .round(true)
        (root);
    
    // Dessiner la treemap
    drawTreemap(root);
}

// 7. PRÉPARATION DES DONNÉES HIÉRARCHIQUES
function prepareHierarchyData(dataset) {
    const hierarchy = {
        name: "Tous les vols",
        children: []
    };
    
    // Grouper par catégorie de distance
    const byDistance = d3.group(dataset, d => d.distance_category);
    
    byDistance.forEach((distanceData, distanceCategory) => {
        const totalFlights = d3.sum(distanceData, d => d.flight_number);
        const ontimeFlights = totalFlights - d3.sum(distanceData, d => d.is_late);
        
        const distanceNode = {
            name: distanceCategory,
            children: []
        };
        
        // Vols en retard - subdivisés par type de retard
        config.delayTypes.forEach(delayType => {
            const delayCount = d3.sum(distanceData, d => d[delayType.key]);
            if (delayCount > 0) {
                distanceNode.children.push({
                    name: delayType.name,
                    value: delayCount,
                    status: "late",
                    delayType: delayType.color,
                    category: distanceCategory,
                    percentage: ((delayCount / totalFlights) * 100).toFixed(1),
                    total: totalFlights
                });
            }
        });
        
        // Vols à l'heure
        if (ontimeFlights > 0) {
            distanceNode.children.push({
                name: "À l'heure",
                value: ontimeFlights,
                status: "ontime",
                category: distanceCategory,
                percentage: ((ontimeFlights / totalFlights) * 100).toFixed(1),
                total: totalFlights
            });
        }
        
        hierarchy.children.push(distanceNode);
    });
    
    return hierarchy;
}

// 8. DESSIN DE LA TREEMAP
function drawTreemap(root) {
    // Supprimer les éléments existants
    svg.selectAll("*").remove();
    
    // Créer un groupe pour chaque catégorie de distance (niveau 1)
    const distanceGroups = svg.selectAll("g.distance-group")
        .data(root.children)
        .join("g")
        .attr("class", "distance-group");
    
    // Dessiner les rectangles de fond pour chaque catégorie
    distanceGroups.append("rect")
        .attr("x", d => d.x0)
        .attr("y", d => d.y0)
        .attr("width", d => d.x1 - d.x0)
        .attr("height", d => d.y1 - d.y0)
        .attr("fill", "rgba(248, 250, 252, 0.4)")
        .attr("stroke", "#cbd5e1")
        .attr("stroke-width", 3)
        .attr("stroke-dasharray", "5,5")
        .attr("rx", 4);
    
    // Ajouter un rectangle de fond pour le titre
    distanceGroups.append("rect")
        .attr("x", d => d.x0)
        .attr("y", d => d.y0)
        .attr("width", d => d.x1 - d.x0)
        .attr("height", 28)
        .attr("fill", "rgba(226, 232, 240, 0.6)")
        .attr("rx", 4);
    
    // Ajouter le titre de la catégorie de distance
    distanceGroups.append("text")
        .attr("class", "treemap-text-category")
        .attr("x", d => d.x0 + 8)
        .attr("y", d => d.y0 + 19)
        .text(d => d.data.name)
        .each(function(d) {
            const bbox = this.getBBox();
            const rectWidth = d.x1 - d.x0;
            if (bbox.width > rectWidth - 16) {
                d3.select(this).text(truncateText(d.data.name, rectWidth - 16));
            }
        });
    
    // Dessiner les rectangles pour chaque statut (en retard / à l'heure)
    const leaves = svg.selectAll("g.leaf")
        .data(root.leaves())
        .join("g")
        .attr("class", "leaf");
    
    leaves.append("rect")
        .attr("class", "treemap-rect")
        .attr("x", d => d.x0)
        .attr("y", d => d.y0 + 30) // Décalage pour le titre de catégorie
        .attr("width", d => Math.max(0, d.x1 - d.x0))
        .attr("height", d => Math.max(0, d.y1 - d.y0 - 30))
        .attr("fill", d => {
            if (d.data.status === "ontime") {
                return config.colors.ontime;
            } else {
                return config.colors[d.data.delayType];
            }
        })
        .attr("rx", 4)
        .on("mouseover", function(event, d) {
            showTooltip(event, d);
        })
        .on("mousemove", function(event) {
            moveTooltip(event);
        })
        .on("mouseout", function() {
            hideTooltip();
        });
    
    // Ajouter le texte pour chaque rectangle
    leaves.each(function(d) {
        const g = d3.select(this);
        const rectWidth = d.x1 - d.x0;
        const rectHeight = d.y1 - d.y0 - 30;
        const centerX = d.x0 + rectWidth / 2;
        const centerY = d.y0 + 30 + rectHeight / 2;
        
        // Afficher le texte seulement si le rectangle est assez grand
        if (rectWidth > 60 && rectHeight > 40) {
            // Nom du statut
            g.append("text")
                .attr("class", "treemap-text")
                .attr("x", centerX)
                .attr("y", centerY - 8)
                .attr("text-anchor", "middle")
                .text(d.data.name);
            
            // Nombre de vols
            g.append("text")
                .attr("class", "treemap-text-value")
                .attr("x", centerX)
                .attr("y", centerY + 8)
                .attr("text-anchor", "middle")
                .text(`${d.data.value.toLocaleString()} vols`);
            
            // Pourcentage
            if (rectHeight > 60) {
                g.append("text")
                    .attr("class", "treemap-text-value")
                    .attr("x", centerX)
                    .attr("y", centerY + 24)
                    .attr("text-anchor", "middle")
                    .text(`${d.data.percentage}%`);
            }
        }
    });
}

// 9. FONCTIONS TOOLTIP
function showTooltip(event, d) {
    let html = `
        <div class="tooltip-title">${d.data.category} - ${d.data.name}</div>
        <div class="tooltip-row">
            <span class="tooltip-label">Vols:</span>
            <span class="tooltip-value">${d.data.value.toLocaleString()}</span>
        </div>
        <div class="tooltip-row">
            <span class="tooltip-label">Pourcentage:</span>
            <span class="tooltip-value">${d.data.percentage}%</span>
        </div>
        <div class="tooltip-row">
            <span class="tooltip-label">Total catégorie:</span>
            <span class="tooltip-value">${d.data.total.toLocaleString()}</span>
        </div>
    `;
    
    // TODO: Ajouter les statistiques de retard quand disponibles
    // if (d.data.status === "late" && d.data.avg_delay) {
    //     html += `
    //         <div class="tooltip-row">
    //             <span class="tooltip-label">Retard moyen:</span>
    //             <span class="tooltip-value">${d.data.avg_delay} min</span>
    //         </div>
    //         <div class="tooltip-row">
    //             <span class="tooltip-label">Retard médian:</span>
    //             <span class="tooltip-value">${d.data.median_delay} min</span>
    //         </div>
    //     `;
    // }
    
    tooltip.html(html);
    
    // Positionner le tooltip intelligemment pour qu'il reste visible
    const tooltipNode = tooltip.node();
    const tooltipWidth = tooltipNode.offsetWidth;
    const tooltipHeight = tooltipNode.offsetHeight;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    let left = event.clientX + 15;
    let top = event.clientY - 28;
    
    // Ajuster si le tooltip dépasse à droite
    if (left + tooltipWidth > windowWidth - 10) {
        left = event.clientX - tooltipWidth - 15;
    }
    
    // Ajuster si le tooltip dépasse en bas
    if (top + tooltipHeight > windowHeight - 10) {
        top = windowHeight - tooltipHeight - 10;
    }
    
    // Ajuster si le tooltip dépasse en haut
    if (top < 10) {
        top = 10;
    }
    
    tooltip
        .style("left", left + "px")
        .style("top", top + "px")
        .classed("hidden", false);
}

function moveTooltip(event) {
    const tooltipNode = tooltip.node();
    const tooltipWidth = tooltipNode.offsetWidth;
    const tooltipHeight = tooltipNode.offsetHeight;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    let left = event.clientX + 15;
    let top = event.clientY - 28;
    
    // Ajuster si le tooltip dépasse à droite
    if (left + tooltipWidth > windowWidth - 10) {
        left = event.clientX - tooltipWidth - 15;
    }
    
    // Ajuster si le tooltip dépasse en bas
    if (top + tooltipHeight > windowHeight - 10) {
        top = windowHeight - tooltipHeight - 10;
    }
    
    // Ajuster si le tooltip dépasse en haut
    if (top < 10) {
        top = 10;
    }
    
    tooltip
        .style("left", left + "px")
        .style("top", top + "px");
}

function hideTooltip() {
    tooltip.classed("hidden", true);
}

// 10. UTILITAIRES
function truncateText(text, maxWidth) {
    // Fonction simple de troncature (peut être améliorée)
    const avgCharWidth = 8;
    const maxChars = Math.floor(maxWidth / avgCharWidth);
    if (text.length > maxChars) {
        return text.substring(0, maxChars - 3) + "...";
    }
    return text;
}

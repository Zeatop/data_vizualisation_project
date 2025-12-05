// ================== PARAMÈTRES GLOBAUX ==================
const margin = { top: 40, right: 30, bottom: 60, left: 70 };
const width  = 900 - margin.left - margin.right;
const height = 400 - margin.top - margin.bottom;

const colorsStatus = {
    on_time:   "#a6cee3",
    late:      "#fb9a99",
    cancelled: "#b2df8a"
};

const colorsDelayTypes = {
    carrier_delay:       "#1f78b4",
    weather_delay:       "#33a02c",
    traffic_delay:       "#e31a1c",
    security_delay:      "#ff7f00",
    late_aircraft_delay:"#6a3d9a"
};

// ================== UTILS ==================
const monthNames = [
    "", "Jan", "Fév", "Mars", "Avr", "Mai", "Juin",
    "Juil", "Août", "Sep", "Oct", "Nov", "Déc"
];

function createSvg(containerId) {
    return d3.select(containerId)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
}

// ================== CHART 1 : TEMPOREL ==================
const svgTime = createSvg("#time-chart");

const xTime = d3.scaleBand().padding(0.2).range([0, width]);
const yTime = d3.scaleLinear().range([height, 0]);

const xAxisTime = svgTime.append("g")
    .attr("transform", `translate(0,${height})`);

const yAxisTime = svgTime.append("g");

const timeLegend = svgTime.append("g")
    .attr("class", "legend")
    .attr("transform", "translate(0,-30)");

const timeColorScale = d3.scaleOrdinal()
    .domain(["on_time", "late", "cancelled"])
    .range([colorsStatus.on_time, colorsStatus.late, colorsStatus.cancelled]);

// Légende du chart temporel
function drawTimeLegend() {
    const keys = ["on_time", "late", "cancelled"];
    const labels = {
        on_time: "À l'heure",
        late: "En retard",
        cancelled: "Annulé"
    };

    const legendItems = timeLegend
        .selectAll(".legend-item")
        .data(keys)
        .join("g")
        .attr("class", "legend-item")
        .attr("transform", (d, i) => `translate(${i * 130}, 0)`);

    legendItems.append("rect")
        .attr("width", 14)
        .attr("height", 14)
        .attr("y", -10)
        .attr("fill", d => timeColorScale(d));

    legendItems.append("text")
        .attr("x", 20)
        .attr("y", 0)
        .attr("dy", "-1px")
        .text(d => labels[d]);
}

drawTimeLegend();

let timeDataMonth = [];
let timeDataWeek = [];

function prepareTemporalDataMonth(rows) {
    // Regroupe par mois et somme les valeurs
    const grouped = d3.rollup(
        rows,
        v => {
            const total = d3.sum(v, d => +d.flight_number);
            const late = d3.sum(v, d => +d.is_late);
            const cancelled = d3.sum(v, d => +d.cancelled);
            const onTime = Math.max(total - late - cancelled, 0);
            return { total, late, cancelled, onTime };
        },
        d => +d.month
    );

    return Array.from(grouped, ([month, vals]) => ({
        key: monthNames[month],
        month: month,
        total: vals.total,
        late: vals.late,
        cancelled: vals.cancelled,
        on_time: vals.onTime
    })).sort((a, b) => a.month - b.month);
}

function prepareTemporalDataWeek(rows) {
    const grouped = d3.rollup(
        rows,
        v => {
            const total = d3.sum(v, d => +d.flight_number);
            const late = d3.sum(v, d => +d.is_late);
            const cancelled = d3.sum(v, d => +d.cancelled);
            const onTime = Math.max(total - late - cancelled, 0);
            return { total, late, cancelled, onTime };
        },
        d => +d.week_number
    );

    return Array.from(grouped, ([week, vals]) => ({
        key: `S${week}`,
        week_number: week,
        total: vals.total,
        late: vals.late,
        cancelled: vals.cancelled,
        on_time: vals.onTime
    })).sort((a, b) => a.week_number - b.week_number);
}

function updateTimeChart(granularity = "month", mode = "count") {
    const rawData = granularity === "month" ? timeDataMonth : timeDataWeek;

    const keys = ["on_time", "late", "cancelled"];

    // On prépare les données pour le stack
    const dataForStack = rawData.map(d => {
        const base = { key: d.key };
        if (mode === "count") {
            base.on_time = d.on_time;
            base.late = d.late;
            base.cancelled = d.cancelled;
        } else {
            // Taux en %
            const total = d.total || 1;
            base.on_time = (d.on_time / total) * 100;
            base.late = (d.late / total) * 100;
            base.cancelled = (d.cancelled / total) * 100;
        }
        return base;
    });

    xTime.domain(dataForStack.map(d => d.key));

    const maxY = mode === "count"
        ? d3.max(rawData, d => d.total)
        : 100;

    yTime.domain([0, maxY]);

    const stack = d3.stack().keys(keys)(dataForStack);

    // Axes
    xAxisTime
        .transition()
        .call(d3.axisBottom(xTime));

    yAxisTime
        .transition()
        .call(d3.axisLeft(yTime).ticks(10).tickFormat(d => mode === "rate" ? d + "%" : d));

    // Binding
    const groups = svgTime.selectAll(".serie")
        .data(stack, d => d.key);

    groups.join(
        enter => enter.append("g")
            .attr("class", "serie")
            .attr("fill", d => timeColorScale(d.key)),
        update => update,
        exit => exit.remove()
    );

    svgTime.selectAll(".serie")
        .selectAll("rect")
        .data(d => d.map(v => ({ key: v.data.key, y0: v[0], y1: v[1], serie: d.key })))
        .join(
            enter => enter.append("rect")
                .attr("x", d => xTime(d.key))
                .attr("y", d => yTime(d.y1))
                .attr("height", d => yTime(d.y0) - yTime(d.y1))
                .attr("width", xTime.bandwidth()),
            update => update
                .transition()
                .attr("x", d => xTime(d.key))
                .attr("y", d => yTime(d.y1))
                .attr("height", d => yTime(d.y0) - yTime(d.y1))
                .attr("width", xTime.bandwidth()),
            exit => exit.remove()
        );

    // Label axe Y
    const yLabel = mode === "count" ? "Nombre de vols" : "Taux (%)";

    svgTime.selectAll(".y-label").remove();
    svgTime.append("text")
        .attr("class", "y-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -margin.left + 15)
        .attr("text-anchor", "middle")
        .text(yLabel);
}

// ================== CHART 2 : TYPES DE RETARD ==================
const svgDelay = createSvg("#delay-chart");

const xDelay = d3.scaleBand().padding(0.2).range([0, width]);
const yDelay = d3.scaleLinear().range([height, 0]);

const xAxisDelay = svgDelay.append("g")
    .attr("transform", `translate(0,${height})`);

const yAxisDelay = svgDelay.append("g");

const delayLegend = svgDelay.append("g")
    .attr("class", "legend")
    .attr("transform", "translate(0,-30)");

const delayColorScale = d3.scaleOrdinal()
    .domain(Object.keys(colorsDelayTypes))
    .range(Object.values(colorsDelayTypes));

function drawDelayLegend() {
    const keys = [
        "carrier_delay",
        "weather_delay",
        "traffic_delay",
        "security_delay",
        "late_aircraft_delay"
    ];

    const labels = {
        carrier_delay: "Carrier",
        weather_delay: "Météo",
        traffic_delay: "Trafic NAS",
        security_delay: "Sécurité",
        late_aircraft_delay: "Late aircraft"
    };

    const legendItems = delayLegend
        .selectAll(".legend-item")
        .data(keys)
        .join("g")
        .attr("class", "legend-item")
        .attr("transform", (d, i) => `translate(${i * 130}, 0)`);

    legendItems.append("rect")
        .attr("width", 14)
        .attr("height", 14)
        .attr("y", -10)
        .attr("fill", d => delayColorScale(d));

    legendItems.append("text")
        .attr("x", 20)
        .attr("y", 0)
        .attr("dy", "-1px")
        .text(d => labels[d]);
}

drawDelayLegend();

let delayData = [];

function prepareDelayData(rows) {
    return rows.map(d => {
        const carrierDelay = +d.bool_carrier_delay_min;
        const weatherDelay = +d.bool_weather_delay_min;
        const trafficDelay = +d.bool_traffic_delay_min;
        const securityDelay = +d.bool_security_delay_min;
        const lateAircraftDelay = +d.bool_late_aircraft_delay_min;
        const isLate = +d.is_late || 0;

        const totalDelayTypes = carrierDelay + weatherDelay + trafficDelay + securityDelay + lateAircraftDelay;

        // Si on veut des taux plus tard
        const rateFactor = isLate > 0 ? isLate : (totalDelayTypes || 1);

        return {
            carrier_name: d.carrier_name,
            carrier_delay: carrierDelay,
            weather_delay: weatherDelay,
            traffic_delay: trafficDelay,
            security_delay: securityDelay,
            late_aircraft_delay: lateAircraftDelay,
            is_late: isLate,
            total_delay_types: totalDelayTypes,
            rateFactor: rateFactor
        };
    });
}

function updateDelayChart(mode = "count") {
    const keys = [
        "carrier_delay",
        "weather_delay",
        "traffic_delay",
        "security_delay",
        "late_aircraft_delay"
    ];

    const dataForStack = delayData.map(d => {
        if (mode === "count") {
            return {
                carrier_name: d.carrier_name,
                carrier_delay: d.carrier_delay,
                weather_delay: d.weather_delay,
                traffic_delay: d.traffic_delay,
                security_delay: d.security_delay,
                late_aircraft_delay: d.late_aircraft_delay
            };
        } else {
            // Taux % parmi les vols en retard (ou total des types si incohérence)
            const base = { carrier_name: d.carrier_name };
            const denom = d.is_late > 0 ? d.is_late : (d.total_delay_types || 1);
            base.carrier_delay       = (d.carrier_delay       / denom) * 100;
            base.weather_delay       = (d.weather_delay       / denom) * 100;
            base.traffic_delay       = (d.traffic_delay       / denom) * 100;
            base.security_delay      = (d.security_delay      / denom) * 100;
            base.late_aircraft_delay = (d.late_aircraft_delay / denom) * 100;
            return base;
        }
    });

    xDelay.domain(dataForStack.map(d => d.carrier_name));

    const maxY = mode === "count"
        ? d3.max(delayData, d => d.total_delay_types)
        : 100;

    yDelay.domain([0, maxY]);

    const stack = d3.stack().keys(keys)(dataForStack);

    xAxisDelay
        .transition()
        .call(d3.axisBottom(xDelay))
        .selectAll("text")
        .attr("transform", "rotate(-35)")
        .style("text-anchor", "end");

    yAxisDelay
        .transition()
        .call(d3.axisLeft(yDelay).ticks(10).tickFormat(d => mode === "rate" ? d + "%" : d));

    const groups = svgDelay.selectAll(".delay-serie")
        .data(stack, d => d.key);

    groups.join(
        enter => enter.append("g")
            .attr("class", "delay-serie")
            .attr("fill", d => delayColorScale(d.key)),
        update => update,
        exit => exit.remove()
    );

    svgDelay.selectAll(".delay-serie")
        .selectAll("rect")
        .data(d => d.map(v => ({
            carrier_name: v.data.carrier_name,
            y0: v[0],
            y1: v[1],
            serie: d.key
        })))
        .join(
            enter => enter.append("rect")
                .attr("x", d => xDelay(d.carrier_name))
                .attr("y", d => yDelay(d.y1))
                .attr("height", d => yDelay(d.y0) - yDelay(d.y1))
                .attr("width", xDelay.bandwidth()),
            update => update
                .transition()
                .attr("x", d => xDelay(d.carrier_name))
                .attr("y", d => yDelay(d.y1))
                .attr("height", d => yDelay(d.y0) - yDelay(d.y1))
                .attr("width", xDelay.bandwidth()),
            exit => exit.remove()
        );

    svgDelay.selectAll(".y-label").remove();
    svgDelay.append("text")
        .attr("class", "y-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -margin.left + 15)
        .attr("text-anchor", "middle")
        .text(mode === "count" ? "Nombre de vols en retard par type" : "Taux (%) parmi les vols retardés");
}

// ================== CHARGEMENT DES DONNÉES ==================
Promise.all([
    d3.csv("dataKhadija/aggregated_by_month_and_carrier.csv"),
    d3.csv("dataKhadija/aggregated_by_week_and_carrier.csv"),
    d3.csv("dataKhadija/aggregated_by_late_type_and_carrier.csv")
]).then(([monthRows, weekRows, delayRows]) => {
    timeDataMonth = prepareTemporalDataMonth(monthRows);
    timeDataWeek  = prepareTemporalDataWeek(weekRows);
    delayData     = prepareDelayData(delayRows);

    // Premier affichage
    updateTimeChart("month", "count");
    updateDelayChart("count");

    // Écouteurs sur les filtres
    d3.select("#time-granularity").on("change", function() {
        const granularity = this.value;
        const mode = d3.select("#time-mode").node().value;
        updateTimeChart(granularity, mode);
    });

    d3.select("#time-mode").on("change", function() {
        const mode = this.value;
        const granularity = d3.select("#time-granularity").node().value;
        updateTimeChart(granularity, mode);
    });

    d3.select("#delay-mode").on("change", function() {
        updateDelayChart(this.value);
    });

}).catch(err => {
    console.error("Erreur lors du chargement des CSV :", err);
});

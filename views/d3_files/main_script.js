// Toggle visibility of map
let mapVisible = true;
function toggleMapVisibility() {
  const mapContainer = document.getElementById('map-container');
  const toggleBtn = document.getElementById('map-toggle-btn');
  
  mapVisible = !mapVisible;
  
  if (mapVisible) {
    mapContainer.style.display = 'block';
    toggleBtn.textContent = '👁️ Masquer';
    toggleBtn.style.background = '#667eea';
  } else {
    mapContainer.style.display = 'none';
    toggleBtn.textContent = '👁️ Afficher';
    toggleBtn.style.background = '#94a3b8';
  }
}

// Communication avec l'iframe du streamchart
window.addEventListener('DOMContentLoaded', function() {
  const iframe = document.getElementById('streamchart-iframe');
  const mapIframe = document.getElementById('map-iframe');
  const treemapIframe = document.getElementById('treemap-iframe');
  const stackedbarchartIframe = document.getElementById('stackedbarchart-iframe');
  const citySelect = document.getElementById('citySelect');
  const timeSelect = document.getElementById('timeSelect');
  const timePeriodRadios = document.querySelectorAll('input[name="timePeriod"]');
  const viewModeRadios = document.querySelectorAll('input[name="viewMode"]');
  
  // Fonction pour envoyer les paramètres à l'iframe
  function sendUpdateToIframe() {
    const selectedCity = citySelect.value;
    const selectedPeriod = document.querySelector('input[name="timePeriod"]:checked').value;
    const selectedMode = document.querySelector('input[name="viewMode"]:checked').value;
    const selectedTime = timeSelect.value;
    
    // Attendre que les iframes soient chargées
    setTimeout(() => {
      // Envoyer au streamchart - utiliser citySelect pour le filtrage
      iframe.contentWindow.postMessage({
        type: 'updateStreamchart',
        city: selectedCity,
        period: selectedPeriod,
        mode: selectedMode
      }, '*');
      
      // Envoyer la ville de focus à la carte (vide si "All")
      const mapCity = selectedCity === 'All' ? '' : selectedCity;
      mapIframe.contentWindow.postMessage({
        type: 'updateMapCity',
        city: mapCity
      }, '*');
      
      // Envoyer la période et la valeur temporelle sélectionnée à la carte
      mapIframe.contentWindow.postMessage({
        type: 'updateMapPeriod',
        period: selectedPeriod,
        timeValue: selectedTime
      }, '*');
      
      // Envoyer la période et la valeur temporelle à la treemap
      treemapIframe.contentWindow.postMessage({
        type: 'updateTreemap',
        period: selectedPeriod,
        timeValue: selectedTime
      }, '*');
      
      // Envoyer la période et la valeur temporelle au stacked bar chart
      stackedbarchartIframe.contentWindow.postMessage({
        type: 'updateStackedBarChart',
        period: selectedPeriod,
        timeValue: selectedTime,
        mode: selectedMode
      }, '*');
    }, 100);
  }
  
  // Fonction pour mettre à jour les options du dropdown temporel
  function updateTimeOptions() {
    const selectedPeriod = document.querySelector('input[name="timePeriod"]:checked').value;
    timeSelect.innerHTML = '';
    
    if (selectedPeriod === 'month') {
      timeSelect.innerHTML = `
        <option value="1">Janvier</option>
        <option value="2">Février</option>
        <option value="3">Mars</option>
        <option value="4">Avril</option>
        <option value="5">Mai</option>
        <option value="6">Juin</option>
        <option value="7">Juillet</option>
        <option value="8">Août</option>
        <option value="9">Septembre</option>
        <option value="10">Octobre</option>
        <option value="11">Novembre</option>
        <option value="12">Décembre</option>
      `;
    } else {
      for (let i = 1; i <= 52; i++) {
        timeSelect.innerHTML += `<option value="${i}">Semaine ${i}</option>`;
      }
    }
    
    sendUpdateToIframe();
  }
  
  // Écouter les changements des contrôles
  citySelect.addEventListener('change', sendUpdateToIframe);
  timeSelect.addEventListener('change', sendUpdateToIframe);
  
  timePeriodRadios.forEach(radio => {
    radio.addEventListener('change', updateTimeOptions);
  });
  
  viewModeRadios.forEach(radio => {
    radio.addEventListener('change', sendUpdateToIframe);
  });
  
  // Écouter les changements des filtres de types de retard
  const delayFilters = document.querySelectorAll('.delay-filter-item input[type="checkbox"]');
  delayFilters.forEach(checkbox => {
    checkbox.addEventListener('change', function() {
      const enabledDelayTypes = {
        carrier: document.getElementById('filter-carrier').checked,
        weather: document.getElementById('filter-weather').checked,
        traffic: document.getElementById('filter-traffic').checked,
        security: document.getElementById('filter-security').checked,
        late_aircraft: document.getElementById('filter-aircraft').checked,
        ontime: document.getElementById('filter-ontime').checked
      };
      
      // Envoyer aux deux iframes
      iframe.contentWindow.postMessage({
        type: 'updateDelayFilters',
        enabledDelayTypes: enabledDelayTypes
      }, '*');
      
      stackedbarchartIframe.contentWindow.postMessage({
        type: 'updateDelayFilters',
        enabledDelayTypes: enabledDelayTypes
      }, '*');
    });
  });
  
  // Recevoir la liste des villes depuis l'iframe
  window.addEventListener('message', function(event) {
    if (event.data.type === 'citiesLoaded' || event.data.type === 'mapCitiesLoaded') {
      // Utiliser le même dropdown pour les villes du streamchart et de la map
      citySelect.innerHTML = '<option value="All">🌍 Toutes les villes</option>';
      event.data.cities.forEach(city => {
        const option = document.createElement('option');
        option.value = city;
        option.textContent = city;
        citySelect.appendChild(option);
      });
      citySelect.value = 'All';
    }
  });
});

// ---------------- Utils ----------------
function parseCSV(text){
  const rows=[]; let row=[], i=0, cur='', q=false;
  while(i<text.length){
    const ch=text[i];
    if(q){
      if(ch=='"'){ if(text[i+1]=='"'){cur+='"'; i++;} else {q=false;} }
      else cur+=ch;
    }else{
      if(ch=='"') q=true;
      else if(ch==','){ row.push(cur); cur=''; }
      else if(ch=='\n'){ row.push(cur); rows.push(row); row=[]; cur=''; }
      else if(ch=='\r'){ /*ignore*/ }
      else cur+=ch;
    }
    i++;
  }
  if(cur.length>0 || row.length>0){ row.push(cur); rows.push(row); }
  return rows;
}
function toNum(x){ if(x===null||x===undefined) return NaN; const n=Number(String(x).replace(/[^0-9eE+\.\-]/g,'')); return Number.isFinite(n)?n:NaN; }
function deg2rad(d){ return d*Math.PI/180; }
function havKm(aLat,aLon,bLat,bLon){
  const R=6371, dLat=deg2rad(bLat-aLat), dLon=deg2rad(bLon-aLon);
  const la1=deg2rad(aLat), la2=deg2rad(bLat);
  const h=Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
}
function groupBy(arr,key){ const m=new Map(); for(const it of arr){ const k=key(it); if(!m.has(k)) m.set(k,[]); m.get(k).push(it);} return m; }
function colIndex(letter){ return letter.trim().toUpperCase().charCodeAt(0)-65; }

// ---------------- Map ----------------
const map=L.map('map').setView([40.7,-74.0],4);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(map);

let impactMarker=L.circleMarker([40.7,-74.0],{radius:7,color:'#22c55e',weight:2,fillOpacity:.9}).addTo(map);
let craterCircle=null, tsunamiCircle=null;
const quakeLayer=L.layerGroup().addTo(map);
const tsunamiLayer=L.layerGroup().addTo(map);
const cityLayer=L.layerGroup().addTo(map);

map.on('click',e=>{
  const pos = e.latlng;
  if(impactMarker) map.removeLayer(impactMarker);
  impactMarker = L.circleMarker(pos, {
    radius:7,
    color:'#22c55e',
    weight:2,
    fillOpacity:.9
  }).addTo(map);
  
  // Add popup to impact marker
  impactMarker.bindPopup(`
    <b>Impact Location</b><br>
    Lat: ${pos.lat.toFixed(4)}°<br>
    Lon: ${pos.lng.toFixed(4)}°
  `).openPopup();
});

// ---------------- State ----------------
let neoRows=[], quakeRows=[], tsunamiRows=[];
const meteorSelect=document.getElementById('meteorSelect');
const loadStatus=document.getElementById('loadStatus');

// Cities (compact global set)
const cities=[
  {name:'New York',lat:40.7128,lon:-74.0060,continent:'North America'},
  {name:'Los Angeles',lat:34.0522,lon:-118.2437,continent:'North America'},
  {name:'Mexico City',lat:19.4326,lon:-99.1332,continent:'North America'},
  {name:'Toronto',lat:43.6532,lon:-79.3832,continent:'North America'},
  {name:'São Paulo',lat:-23.5505,lon:-46.6333,continent:'South America'},
  {name:'Buenos Aires',lat:-34.6037,lon:-58.3816,continent:'South America'},
  {name:'Lima',lat:-12.0464,lon:-77.0428,continent:'South America'},
  {name:'Bogotá',lat:4.7110,lon:-74.0721,continent:'South America'},
  {name:'London',lat:51.5074,lon:-0.1278,continent:'Europe'},
  {name:'Paris',lat:48.8566,lon:2.3522,continent:'Europe'},
  {name:'Berlin',lat:52.5200,lon:13.4050,continent:'Europe'},
  {name:'Madrid',lat:40.4168,lon:-3.7038,continent:'Europe'},
  {name:'Lagos',lat:6.5244,lon:3.3792,continent:'Africa'},
  {name:'Cairo',lat:30.0444,lon:31.2357,continent:'Africa'},
  {name:'Johannesburg',lat:-26.2041,lon:28.0473,continent:'Africa'},
  {name:'Nairobi',lat:-1.2921,lon:36.8219,continent:'Africa'},
  {name:'Tokyo',lat:35.6762,lon:139.6503,continent:'Asia'},
  {name:'Shanghai',lat:31.2304,lon:121.4737,continent:'Asia'},
  {name:'Delhi',lat:28.7041,lon:77.1025,continent:'Asia'},
  {name:'Seoul',lat:37.5665,lon:126.9780,continent:'Asia'},
  {name:'Sydney',lat:-33.8688,lon:151.2093,continent:'Oceania'},
  {name:'Melbourne',lat:-37.8136,lon:144.9631,continent:'Oceania'},
  {name:'Auckland',lat:-36.8485,lon:174.7633,continent:'Oceania'},
  {name:'Perth',lat:-31.9523,lon:115.8613,continent:'Oceania'},
  {name:'McMurdo Station',lat:-77.8419,lon:166.6863,continent:'Antarctica'},
  {name:'Amundsen-Scott South Pole',lat:-90,lon:0,continent:'Antarctica'}
];

// --------------- File uploads ---------------
function populateMeteorSelect(header, rows) {
  meteorSelect.innerHTML = '<option value="">— Select a NEO —</option>';
  rows.forEach((row, i) => {
    const date = row[header.indexOf('date')];
    const name = row[header.indexOf('name')];
    const id = row[header.indexOf('id')];
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `${date} - ${name} (${id})`;
    meteorSelect.appendChild(option);
  });
}

document.getElementById('neoCsv').addEventListener('change', async (e)=>{
  const f=e.target.files?.[0]; if(!f) return;
  const text=await f.text(); const rows=parseCSV(text);
  const header=rows[0]||[]; neoRows=rows.slice(1).map(r=>r);
  populateMeteorSelect(header, neoRows); updateLoadStatus();
});
document.getElementById('quakesCsv').addEventListener('change', async (e)=>{
  const f=e.target.files?.[0]; if(!f) return;
  const text=await f.text(); quakeRows=parseCSV(text); updateLoadStatus();
});
document.getElementById('tsunamiCsv').addEventListener('change', async (e)=>{
  const f=e.target.files?.[0]; if(!f) return;
  const text=await f.text(); tsunamiRows=parseCSV(text); updateLoadStatus();
});

function updateLoadStatus(){
  const neo=neoRows.length, q=quakeRows.length?quakeRows.length-1:0, t=tsunamiRows.length?tsunamiRows.length-1:0;
  loadStatus.textContent=`Loaded → NEO: ${neo} | Earthquakes: ${q} | Tsunamis: ${t}`;
}

// --------------- Simulation ---------------
const simulateBtn = document.getElementById('simulateBtn');
const saveBtn = document.getElementById('saveBtn');
const radiusKm = document.getElementById('radiusKm');
const waterDepth = document.getElementById('waterDepth');
const deflection = document.getElementById('deflection');
const density = document.getElementById('density');
const resultsBox = document.getElementById('resultsBox');
const compareBox = document.getElementById('compareBox');
const storyBox = document.getElementById('storyBox');

// Auto-load CSV files
async function loadCSVFile(filename) {
  try {
    const response = await fetch(`excel_data/${filename}`);
    const text = await response.text();
    return parseCSV(text);
  } catch (err) {
    console.error(`Error loading ${filename}:`, err);
    return [];
  }
}

// Load data on startup
window.addEventListener('load', async () => {
  neoRows = await loadCSVFile('neo_data_five_highlighted_only.csv');
  quakeRows = await loadCSVFile('global_earthquake_30_data_clean.csv');
  tsunamiRows = await loadCSVFile('tsunamis_cleaned.csv');
  
  if (neoRows.length > 0) {
    const header = neoRows[0];
    neoRows = neoRows.slice(1);
    populateMeteorSelect(header, neoRows);
  }
  updateLoadStatus();
});

function calculateImpact(meteor, impact) {
  // Constants
  const G = 6.67430e-11; // gravitational constant
  const PI = Math.PI;
  
  // Convert inputs to proper units
  const diameter = meteor.diameter * 1000; // km to meters
  const velocity = meteor.velocity * 1000; // km/s to m/s
  const density = impact.density; // kg/m³
  
  // Calculate impact energy
  const mass = (4/3) * PI * Math.pow(diameter/2, 3) * density;
  const energy = 0.5 * mass * Math.pow(velocity, 2);
  
  // More realistic crater scaling law based on scientific literature
  // Using pi-scaling relationships for crater formation
  const craterRadius = 0.015 * Math.pow(energy, 0.3); // Adjusted coefficient for more realistic sizes
  
  // More realistic tsunami radius calculation
  // Based on water depth and energy scaling
  let tsunamiRadius = 0;
  if (impact.waterDepth > 0) {
    const waterDepth = impact.waterDepth;
    // Modified scaling relationship for tsunami propagation
    tsunamiRadius = 0.2 * Math.pow(energy, 0.25) * Math.pow(waterDepth/1000, 0.5);
  }

  return {
    craterRadius: craterRadius/1000, // Convert to km
    tsunamiRadius: tsunamiRadius, // Already in km
    energy: energy
  };
}

function generateNarrative(meteor, impact, results) {
  const date = meteor.date || "unknown date";
  const name = meteor.name || "unnamed object";
  const location = impact.lat >= 0 ? `${impact.lat.toFixed(1)}°N` : `${(-impact.lat).toFixed(1)}°S`;
  location += impact.lon >= 0 ? `, ${impact.lon.toFixed(1)}°E` : `, ${(-impact.lon).toFixed(1)}°W`;
  
  let story = `On ${date}, the ${name} impacts Earth at ${location}. `;
  story += `The ${meteor.diameter.toFixed(2)}km wide object creates a crater ${results.craterRadius.toFixed(1)}km in radius. `;
  
  if (results.tsunamiRadius > 0) {
    story += `The impact in ${impact.waterDepth}m deep water generates a tsunami affecting an area ${results.tsunamiRadius.toFixed(1)}km in radius. `;
  }
  
  story += `The impact releases ${results.energy.toExponential(2)} joules of energy.`;
  return story;
}

function simulate() {
  if (!meteorSelect.value) {
    alert('Please select a meteor first');
    return;
  }

  const meteor = neoRows[parseInt(meteorSelect.value)];
  if (!meteor) return;
  
  const params = {
    meteor: {
      id: meteor[0],
      name: meteor[2], // name is in the third column
      velocity: parseFloat(meteor[8]), // relative_velocity_km_s
      diameter: (parseFloat(meteor[6]) + parseFloat(meteor[7])) / 2, // avg of min/max diameter
      date: meteor[0] // date is in first column
    },
    impact: {
      lat: impactMarker.getLatLng().lat,
      lon: impactMarker.getLatLng().lng,
      radiusKm: parseFloat(radiusKm.value),
      waterDepth: parseFloat(waterDepth.value),
      deflection: parseFloat(deflection.value),
      density: parseFloat(density.value)
    }
  };

  try {
    // Calculate impact results locally
    const results = calculateImpact(params.meteor, params.impact);
    
    // Update map visualization
    if (craterCircle) map.removeLayer(craterCircle);
    if (tsunamiCircle) map.removeLayer(tsunamiCircle);
    
    craterCircle = L.circle([params.impact.lat, params.impact.lon], {
      radius: results.craterRadius * 1000, // convert km to m
      color: getComputedStyle(document.documentElement).getPropertyValue('--crater'),
      fillOpacity: 0.2
    }).addTo(map);
    
    if (params.impact.waterDepth > 0) {
      tsunamiCircle = L.circle([params.impact.lat, params.impact.lon], {
        radius: results.tsunamiRadius * 1000,
        color: getComputedStyle(document.documentElement).getPropertyValue('--tsu'),
        fillOpacity: 0.15
      }).addTo(map);
    }

    // Process data within radius
    const maxRadius = Math.max(results.craterRadius, results.tsunamiRadius);
    processDataWithinRadius(params.impact.lat, params.impact.lon, maxRadius);
    
    // Update results display
    resultsBox.innerHTML = `
      <b>Simulation Results:</b><br>
      Crater radius: ${results.craterRadius.toFixed(1)}km<br>
      ${params.impact.waterDepth > 0 ? `Tsunami radius: ${results.tsunamiRadius.toFixed(1)}km<br>` : ''}
      Energy released: ${results.energy.toExponential(2)} joules
    `;

    // Generate and display narrative
    const narrative = generateNarrative(params.meteor, params.impact, results);
    storyBox.textContent = narrative;
    
  } catch (err) {
    resultsBox.innerHTML = `<span style="color:var(--warn)">Error: ${err.message}</span>`;
  }
}

// Save functionality is removed since we're working locally

function processDataWithinRadius(impactLat, impactLon, radiusKm) {
  quakeLayer.clearLayers();
  tsunamiLayer.clearLayers();
  cityLayer.clearLayers();
  
  // Process earthquakes
  const quakesInRange = [];
  if (quakeRows.length > 1) {
    for (let i = 1; i < quakeRows.length; i++) {
      const row = quakeRows[i];
      const lat = parseFloat(row[3]);
      const lon = parseFloat(row[4]);
      const dist = havKm(impactLat, impactLon, lat, lon);
      if (dist <= radiusKm) {
        quakesInRange.push({
          dist,
          data: row,
          lat,
          lon,
          magnitude: parseFloat(row[7]),
          date: row[1],
          location: row[9]
        });
      }
    }
  }

  // Display earthquakes on map and in list
  const quakeSummary = document.getElementById('quakeSummary');
  const quakeList = document.getElementById('quakeList');
  
  quakesInRange.sort((a, b) => b.magnitude - a.magnitude);
  quakeSummary.textContent = `Found ${quakesInRange.length} earthquakes within ${radiusKm}km radius`;
  
  quakeList.innerHTML = quakesInRange.map(q => 
    `<div>M${q.magnitude} - ${q.location} (${q.dist.toFixed(0)}km) - ${new Date(q.date).toLocaleDateString()}</div>`
  ).join('');

  quakesInRange.forEach(q => {
    const marker = L.circleMarker([q.lat, q.lon], {
      radius: 3 + q.magnitude,
      color: '#888',
      fillOpacity: 0.6
    }).addTo(quakeLayer);
    
    marker.bindPopup(`
      <b>Earthquake</b><br>
      Magnitude: ${q.magnitude}<br>
      Location: ${q.location}<br>
      Date: ${new Date(q.date).toLocaleDateString()}<br>
      Distance: ${q.dist.toFixed(1)} km<br>
      Depth: ${q.data[5]} km
    `);
  });

  // Process tsunamis
  const row = tsunamiRows[i];

// Correct columns for tsunamis_cleaned.csv:
// location_name = row[13]
// latitude = row[14]
// longitude = row[15]
// maximum_water_height_m = row[16]
const lat = parseFloat(row[14]);
const lon = parseFloat(row[15]);

if (isNaN(lat) || isNaN(lon)) continue;

const dist = havKm(impactLat, impactLon, lat, lon);

if (dist <= radiusKm) {
  tsunamisInRange.push({
    dist,
    data: row,
    lat,
    lon,
    maxHeight: parseFloat(row[16]),
    date: `${row[1]}-${row[2]}-${row[3]}`,
    location: row[13]
  });
}
#testing

  // Display tsunamis on map and in list
  const tsuSummary = document.getElementById('tsuSummary');
  const tsuList = document.getElementById('tsuList');
  
  tsunamisInRange.sort((a, b) => b.maxHeight - a.maxHeight);
  tsuSummary.textContent = `Found ${tsunamisInRange.length} tsunamis within ${radiusKm}km radius`;
  
  tsuList.innerHTML = tsunamisInRange.map(t => 
    `<div>${t.location} - Height: ${t.maxHeight}m (${t.dist.toFixed(0)}km) - ${new Date(t.date).toLocaleDateString()}</div>`
  ).join('');

  tsunamisInRange.forEach(t => {
    const marker = L.circleMarker([t.lat, t.lon], {
      radius: 5,
      color: '#1565c0',
      fillOpacity: 0.6
    }).addTo(tsunamiLayer);
    
    marker.bindPopup(`
      <b>Tsunami</b><br>
      Location: ${t.location}<br>
      Max Height: ${t.maxHeight}m<br>
      Date: ${new Date(t.date).toLocaleDateString()}<br>
      Distance: ${t.dist.toFixed(1)} km
    `);
  });

  // Process cities
  const citiesInRange = cities.map(city => ({
    ...city,
    dist: havKm(impactLat, impactLon, city.lat, city.lon)
  })).filter(c => c.dist <= radiusKm);

  const citiesByContinent = groupBy(citiesInRange, c => c.continent);
  const significantCities = Array.from(citiesByContinent.entries())
    .filter(([_, cities]) => cities.length >= 2)
    .flatMap(([_, cities]) => cities);

  // Display cities on map and in list
  const citySummary = document.getElementById('citySummary');
  const cityList = document.getElementById('cityList');
  
  citySummary.textContent = `Found ${significantCities.length} cities (with ≥2 per continent) within ${radiusKm}km radius`;
  
  cityList.innerHTML = Array.from(citiesByContinent.entries())
    .filter(([_, cities]) => cities.length >= 2)
    .map(([continent, cities]) => `
      <div>
        <b>${continent}</b>: ${cities.map(c => 
          `${c.name} (${c.dist.toFixed(0)}km)`
        ).join(', ')}
      </div>
    `).join('');

  significantCities.forEach(c => {
    const marker = L.circleMarker([c.lat, c.lon], {
      radius: 6,
      color: '#ffa000',
      fillOpacity: 0.6
    }).addTo(cityLayer);
    
    marker.bindPopup(`
      <b>${c.name}</b><br>
      Continent: ${c.continent}<br>
      Distance: ${c.dist.toFixed(1)} km<br>
      Location: ${c.lat.toFixed(4)}°, ${c.lon.toFixed(4)}°
    `);
  });
}

simulateBtn.addEventListener('click', simulate);

// Save button is disabled for now because no save function exists yet.
if (saveBtn) {
  saveBtn.addEventListener('click', () => {
    alert('Save is not available in this prototype yet. You can take a screenshot or copy the results.');
  });
}

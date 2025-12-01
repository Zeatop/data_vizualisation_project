import csv
import json

# Charge la liste de villes de ton fichier
with open('flightData/cities_states_list.csv', newline='', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    target_rows = list(reader)

# Charge la base publique de villes US avec coordonnées (par exemple: us_cities.csv)
with open('uscities.csv', newline='', encoding='utf-8') as f:
    ref_reader = csv.DictReader(f)
    # Normalise les entrées (ville, état)
    ref_dict = {}
    for row in ref_reader:
        key = (row['city'].strip().lower(), row['state_name'].strip().lower())
        ref_dict[key] = {
            'lat': float(row['lat']),
            'lng': float(row['lng'])
        }

features = []
not_found = []

for row in target_rows:
    city = row['city'].split(',')[0].replace('"','').strip().lower()
    state = row['state'].strip().lower()
    coords = ref_dict.get((city, state))
    if coords:
        features.append({
            'type': 'Feature',
            'geometry': {
                'type': 'Point',
                'coordinates': [coords['lng'], coords['lat']]
            },
            'properties': {
                'city': row['city'],
                'state': row['state']
            }
        })
    else:
        not_found.append(f"{row['city']}, {row['state']}")

geojson = {
    'type': 'FeatureCollection',
    'features': features
}

# Sauvegarde le geojson final
with open('us_cities_from_csv.geojson', 'w', encoding='utf-8') as f:
    json.dump(geojson, f, ensure_ascii=False, indent=2)

# Optionnel : Visualise les villes non trouvées dans la base de données
print(f"Villes non trouvées ({len(not_found)}) :", not_found)

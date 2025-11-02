

class DataPreparation():

    columns_mapping = {
    "year": "year",
    "month": "month",
    "day_of_month": "day_of_month",
    "day_of_week": "day_of_week",
    "fl_date": "flight_date",
    "op_unique_carrier": "carrier_code",
    "op_carrier_fl_num": "flight_number",
    "origin": "origin_airport",
    "origin_city_name": "origin_city",
    "origin_state_nm": "origin_state",
    "dest": "dest_airport",
    "dest_city_name": "dest_city",
    "dest_state_nm": "dest_state",
    "crs_dep_time": "scheduled_dep_hhmm", 
    "dep_time": "actual_dep_hhmm",
    "dep_delay": "dep_delay_min",
    "taxi_out": "taxi_out_min",
    "wheels_off": "wheels_off_hhmm",
    "wheels_on": "wheels_on_hhmm",
    "taxi_in": "taxi_in_min",
    "crs_arr_time": "scheduled_arr_hhmm",
    "arr_time": "actual_arr_hhmm",
    "arr_delay": "arr_delay_min",
    "cancelled": "cancelled",
    "cancellation_code": "cancellation_code",
    "diverted": "diverted",
    "crs_elapsed_time": "scheduled_elapsed_min",
    "actual_elapsed_time": "actual_elapsed_min",
    "air_time": "air_time_min",
    "distance": "distance_miles",
    "carrier_delay": "carrier_delay_min",
    "weather_delay": "weather_delay_min",
    "nas_delay": "traffic_delay_min",
    "security_delay": "security_delay_min",
    "late_aircraft_delay": "late_aircraft_delay_min"
    }

    carrier_mapping = {
        "9E": "Endeavor Air",
        "AA": "American Airlines", 
        "AS": "Alaska Airlines",
        "B6": "JetBlue Airways",
        "DL": "Delta Air Lines",
        "F9": "Frontier Airlines",
        "G4": "Allegiant Air",
        "HA": "Hawaiian Airlines",
        "MQ": "Envoy Air",
        "NK": "Spirit Airlines",
        "OH": "PSA Airlines",
        "OO": "SkyWest Airlines",
        "UA": "United Airlines",
        "WN": "Southwest Airlines",
        "YX": "Republic Airways"
    }

    @staticmethod
    def get_carrier_name(carrier_code):
        """
        Retourne le nom complet du transporteur à partir de son code IATA.
        
        Args:
            carrier_code (str): Code IATA du transporteur (ex: 'AA', 'DL', 'UA')
            
        Returns:
            str: Nom complet du transporteur ou le code original si non trouvé
        """
        return DataPreparation.carrier_mapping.get(carrier_code, carrier_code)
    
    @staticmethod
    def add_carrier_names(data):
        """
        Ajoute une colonne avec les noms complets des transporteurs.
        
        Args:
            data (pandas.DataFrame): DataFrame contenant une colonne 'carrier_code'
            
        Returns:
            pandas.DataFrame: DataFrame avec une nouvelle colonne 'carrier_name'
        """
        data['carrier_name'] = data['carrier_code'].map(DataPreparation.carrier_mapping)
        print("Colonne 'carrier_name' ajoutée avec succès:")
        print(data[['carrier_code', 'carrier_name']].drop_duplicates().sort_values('carrier_code'))
        return data

    @staticmethod
    def rename_columns(data):
        data = data.rename(columns=DataPreparation.columns_mapping)
        print("Colonnes après renommage:")
        print(data.head())
        return data

    @staticmethod
    def prepare_location_data(data):
        data['City'] = ''
        data['State'] = ''
        for i, row in data.iterrows():
            location = row['Address']
            state = location.split(' ')[-2]
            if location.split(' ')[-4].replace(',', '').isnumeric():
                city = location.split(' ')[-3]
            else:
                city = (f"{location.split(' ')[-4]} {location.split(' ')[-3]}")
            
            # Assigner les valeurs aux bonnes lignes du DataFrame
            data.at[i, 'State'] = state
            data.at[i, 'City'] = city.replace(',', '')
        
        return data
    
    @staticmethod
    def prepare_age_and_gender_data(data):
        data['Age'] = ''
        data['Gender'] = ''
        for i, row in data.iterrows():
            age_gender = row['age/gender']
            try:
                age_gender = age_gender.split('/')
                age = age_gender[0]
                gender = age_gender[1]
            except Exception as e:
                age = "NA"
                gender = "NA"
                continue
            
        
            # Assigner les valeurs aux bonnes lignes du DataFrame
            data.at[i, 'Age'] = age
            data.at[i, 'Gender'] = gender
        
        return data
    
    @staticmethod
    def analyze_city_data(data):
        print("=== ANALYSE DES DONNÉES CITY ===")
        
        # 1. Compter les valeurs uniques
        print(f"\nNombre total de villes: {data['City'].nunique()}")
        print(f"Nombre total de lignes: {len(data)}")
        
        # 2. Afficher toutes les valeurs uniques
        print(f"\nToutes les villes uniques:")
        unique_cities = data['City'].unique()
        for i, city in enumerate(sorted(unique_cities)):
            print(f"{i+1:2d}. '{city}'")
        
        # 3. Détecter les valeurs vides ou nulles
        empty_cities = data[data['City'].isin(['', 'NA']) | data['City'].isna()]
        if not empty_cities.empty:
            print(f"\n⚠️  {len(empty_cities)} lignes avec des villes vides:")
            print(empty_cities[['Address', 'City']].head())
        
        # 4. Détecter les villes avec des caractères bizarres
        print(f"\n🔍 Villes avec des caractères suspects:")
        suspicious_cities = []
        for city in unique_cities:
            if city:  # Si pas vide
                # Vérifier les caractères numériques
                if any(char.isdigit() for char in city):
                    suspicious_cities.append(f"'{city}' (contient des chiffres)")
                # Vérifier les caractères spéciaux
                if any(char in city for char in ['@', '#', '$', '%', '&', '*']):
                    suspicious_cities.append(f"'{city}' (caractères spéciaux)")
                # Vérifier les longueurs anormales
                if len(city) <= 2:
                    suspicious_cities.append(f"'{city}' (trop court)")
                if len(city) > 30:
                    suspicious_cities.append(f"'{city}' (trop long)")
        
        for suspicious in suspicious_cities:
            print(f"  - {suspicious}")
        
        # 5. Compter les occurrences de chaque ville
        print(f"\n📊 Fréquence des villes:")
        city_counts = data['City'].value_counts()
        print(city_counts.head(10))
        
        # 6. Afficher quelques exemples d'adresses originales pour comparaison
        print(f"\n📍 Exemples d'adresses originales vs villes extraites:")
        sample_data = data[['Address', 'City']].head(5)
        for _, row in sample_data.iterrows():
            print(f"  Adresse: {row['Address']}")
            print(f"  Ville extraite: '{row['City']}'")
            print()
        
        return data

    @staticmethod
    def delete_useless_columns(data, columns_to_delete):
        for column in columns_to_delete:
            if column in data.columns:
                data = data.drop(columns=column, axis='columns')
        print("Colonnes après suppression:")
        print(data.head())
        return data
import pandas as pd
import os

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
    "cancellation_code": "cancellation_code", ## Mapper les cancellation codes
    "diverted": "diverted", ## C'est quoi deiverted ?s
    "crs_elapsed_time": "scheduled_elapsed_min", ## C'est quoi elapsed time ?
    "actual_elapsed_time": "actual_elapsed_min",
    "air_time": "air_time_min",
    "distance": "distance_miles",
    "carrier_delay": "carrier_delay_min",
    "weather_delay": "weather_delay_min",
    "nas_delay": "traffic_delay_min",
    "security_delay": "security_delay_min",
    "late_aircraft_delay": "late_aircraft_delay_min"
    }

    cancellation_mapping = {
        "A": "Carrier",
        "B": "Weather",
        "C": "National Air System",
        "D": "Security"
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
    def add_carrier_name(data):
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
    def add_week_number(data):
        # Convertir flight_date en datetime si ce n'est pas déjà fait
        if not pd.api.types.is_datetime64_any_dtype(data['flight_date']):
            data['flight_date'] = pd.to_datetime(data['flight_date'])
            print("Colonne 'flight_date' convertie en format datetime")
        
        # Ajouter le numéro de semaine
        data['week_number'] = data['flight_date'].dt.isocalendar().week
        print("Colonne 'week_number' ajoutée avec succès:")
        print(data[['flight_date', 'week_number']].head())
        return data
    
    @staticmethod
    def add_booleanize_delays(data):
        delay_columns = ['dep_delay_min', 'arr_delay_min', 'carrier_delay_min', 
                         'weather_delay_min', 'traffic_delay_min', 
                         'security_delay_min', 'late_aircraft_delay_min']

        booleanized_delay_columns = ['bool_dep_delay_min', 'bool_arr_delay_min', 'bool_carrier_delay_min', 
                                     'bool_weather_delay_min', 'bool_traffic_delay_min',
                                     'bool_security_delay_min', 'bool_late_aircraft_delay_min',]

        data['is_late'] = data['arr_delay_min'].apply(lambda x: True if x > 15 else False)
        for i, column in enumerate(delay_columns):
            if column in data.columns:
                data[booleanized_delay_columns[i]] = data[column].apply(lambda x: True if x > 15 else False)
        print("Colonnes après booleanisation des retards:")
        print(data[booleanized_delay_columns].head())
        return data
    
    @staticmethod
    def agregate_data(data, group_by_columns, agg_dict, filepath=None):
        """
        Agrège les données en fonction des colonnes spécifiées et des fonctions d'agrégation.
        
        Args:
            data (pandas.DataFrame): DataFrame à agréger
            group_by_columns (list): Liste des colonnes pour le groupement
            agg_dict (dict): Dictionnaire spécifiant les colonnes à agréger et les fonctions d'agrégation
            
        Returns:
            pandas.DataFrame: DataFrame agrégée
        """
        aggregated_data = data.groupby(group_by_columns).agg(agg_dict).reset_index()
        print("Données agrégées avec succès:")
        print(aggregated_data.head())
        
        if filepath:
            current_directory = os.getcwd()
            filepath = os.path.join(current_directory, filepath)
            aggregated_data.to_csv(filepath, index=False)
            print(f"Données agrégées sauvegardées dans {filepath}")
        return aggregated_data
    
    @staticmethod
    def add_distance_categories(data):
        """
        Ajoute une colonne avec les catégories de distance de vol.
        
        Args:
            data (pandas.DataFrame): DataFrame contenant une colonne 'distance_miles'
            
        Returns:
            pandas.DataFrame: DataFrame avec une nouvelle colonne 'distance_category'
        """
        # Analyser la distribution des distances
        print("=== ANALYSE DE LA DISTRIBUTION DES DISTANCES ===")
        distances = data['distance_miles'].dropna()
        print(f"Distance minimale: {distances.min():.0f} miles")
        print(f"Distance maximale: {distances.max():.0f} miles")
        print(f"Distance moyenne: {distances.mean():.0f} miles")
        print(f"Distance médiane: {distances.median():.0f} miles")
        
        # Quartiles pour comprendre la répartition
        quartiles = distances.quantile([0.25, 0.5, 0.75, 0.9, 0.95])
        print(f"\nQuartiles des distances:")
        for q, value in quartiles.items():
            print(f"  {q*100:.0f}% : {value:.0f} miles")
        
        # Définir des catégories basées sur l'aviation commerciale
        # Ces plages correspondent aux types de vols réels
        def categorize_distance(distance):
            if pd.isna(distance):
                return "Unknown"
            elif distance < 300:
                return "< 300 miles"
            elif distance < 600:
                return "300-599 miles"
            elif distance < 1000:
                return "600-999 miles" 
            elif distance < 1500:
                return "1000-1499 miles"
            elif distance < 2500:
                return "1500-2499 miles"
            else:
                return "≥ 2500 miles"
        
        data['distance_category'] = data['distance_miles'].apply(categorize_distance)
        
        print(f"\n=== RÉPARTITION PAR CATÉGORIE DE DISTANCE ===")
        category_counts = data['distance_category'].value_counts().sort_index()
        total_flights = len(data)
        
        for category, count in category_counts.items():
            percentage = (count / total_flights) * 100
            print(f"{category}: {count:,} vols ({percentage:.1f}%)")
        
        print(f"\nColonne 'distance_category' ajoutée avec succès!")
        print(f"Aperçu des données avec les nouvelles catégories:")
        print(data[['distance_miles', 'distance_category']].head(10))
        
        return data
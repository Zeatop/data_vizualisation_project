

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
    def add_booleanize_delays(data):
        delay_columns = ['carrier_delay_min', 
                         'weather_delay_min', 'traffic_delay_min', 
                         'security_delay_min', 'late_aircraft_delay_min']
        
        booleanized_delay_columns = ['bool_carrier_delay_min', 
                                     'bool_weather_delay_min', 'bool_traffic_delay_min', 
                                     'bool_security_delay_min', 'bool_late_aircraft_delay_min']
        
        for i, column in enumerate(delay_columns):
            if column in data.columns:
                data[booleanized_delay_columns[i]] = data[column].apply(lambda x: True if x > 0 else False)
        print("Colonnes après booleanisation des retards:")
        print(data[booleanized_delay_columns].head())
        return data
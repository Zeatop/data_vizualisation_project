import dowloand_dataset as dl_ds
import os
import pandas
from models import DataPreparation


project_dir = os.getcwd()

folder_list = []
# Specify your desired folder
data_folder = "../FlightData"
folder_list.append(data_folder)

#folders for each persons
data_folder_leo = data_folder + "/leo"
data_folder_credo = data_folder + "/credo"
data_folder_delphine = data_folder + "/delphine"
data_folder_khadija = data_folder + "/khadija"
folder_list.append(data_folder_leo)
folder_list.append(data_folder_credo)
folder_list.append(data_folder_delphine)
folder_list.append(data_folder_khadija)

# Create folders if it doesn't exist
for folder in folder_list:
     if not os.path.exists(folder):
         os.makedirs(folder)

#Download dataset from kaggle
dl_ds.download_dataset(data_folder)



sample_table_path = os.path.join(project_dir, data_folder + "/flight_data_2024_sample.csv")
table_path = os.path.join(project_dir, data_folder + "/flight_data_2024_sample.csv")
#table_path = os.path.join(project_dir, data_folder + "/flight_data_2024.csv")
# TODO : review this bloc above if we switch data set become very a lot

sample_table = pandas.read_csv(sample_table_path, delimiter=',')
table = pandas.read_csv(table_path, delimiter=',')


# Créer une instance de DataPreparation
data_prep = DataPreparation()

# csv liste de villes et états
# Créer une liste simple des villes et états (avec noms de colonnes originaux)
cities_states = pandas.concat([
    table[['origin_city_name', 'origin_state_nm']].rename(columns={'origin_city_name': 'city', 'origin_state_nm': 'state'}),
    table[['dest_city_name', 'dest_state_nm']].rename(columns={'dest_city_name': 'city', 'dest_state_nm': 'state'})
]).drop_duplicates().sort_values(['state', 'city']).reset_index(drop=True)


# Sauvegarder la liste des villes
cities_states.to_csv( data_folder + "/cities_states.csv", index=False)
print(f"Liste des villes sauvegardée : {len(cities_states)} villes uniques")


table = data_prep.rename_columns(data=table)
table = data_prep.add_carrier_name(data=table)
table = data_prep.add_booleanize_delays(data=table)
table = data_prep.add_week_number(data=table)
table = data_prep.add_distance_categories(data=table)
sample_table = data_prep.rename_columns(data=sample_table)
sample_table = data_prep.add_carrier_name(data=sample_table)
sample_table = data_prep.add_booleanize_delays(data=sample_table)
sample_table = data_prep.add_week_number(data=sample_table)
sample_table = data_prep.add_distance_categories(data=sample_table)

# save data after renaming
sample_path = os.path.join(project_dir, data_folder + "/flight_data_2024_sample_renamed.csv")
sample_table.to_csv(sample_path, index=False)
path = os.path.join(project_dir, data_folder + "/flight_data_2024_renamed.csv")
table.to_csv(path, index=False)


'''
Agrégations pour Kadija
'''

# Agréger les données par semaine et par compagnie aérienne
agregated_data = data_prep.agregate_data(
    data=table,
    group_by_columns=['week_number', 'carrier_name'],
    agg_dict={
        'is_late': 'sum',
        'cancelled': 'sum',
        'flight_number': 'count'
    },
    filepath=f"{data_folder_khadija}/aggregated_by_week_and_carrier.csv"
)

# Agréger les données par mois et par compagnie aérienne
agregated_data = data_prep.agregate_data(
    data=table,
    group_by_columns=['month', 'carrier_name'],
    agg_dict={
        'is_late': 'sum',
        'cancelled': 'sum',
        'flight_number': 'count'
    },
    filepath=f"{data_folder_khadija}/aggregated_by_month_and_carrier.csv"
)

# Agréger les données par type de retard et par compagnie aérienne
agregated_data = data_prep.agregate_data(
    data=table,
    group_by_columns=['carrier_name'],
    agg_dict={
        'bool_carrier_delay_min': 'sum',
        'bool_weather_delay_min': 'sum',
        'bool_traffic_delay_min': 'sum',
        'bool_security_delay_min': 'sum',
        'bool_late_aircraft_delay_min': 'sum',
        'is_late': 'sum',
        'cancelled': 'sum',
        'flight_number': 'count'
    },
    filepath=f"{data_folder_khadija}/aggregated_by_late_type_and_carrier.csv"
)

'''
Agrégations pour Delphine
'''

# Agréger les données par semaine et par catégorie de distance
agregated_data = data_prep.agregate_data(
    data=table,
    group_by_columns=['week_number', 'distance_category'],
    agg_dict={
        'is_late': 'sum',
        'cancelled': 'sum',
        'flight_number': 'count'
    },
    filepath=f"{data_folder_delphine}/aggregated_by_week_and_distance_category.csv"
)

# Agréger les données par mois et par catégorie de distance
agregated_data = data_prep.agregate_data(
    data=table,
    group_by_columns=['month', 'distance_category'],
    agg_dict={
        'is_late': 'sum',
        'cancelled': 'sum',
        'flight_number': 'count'
    },
    filepath=f"{data_folder_delphine}/aggregated_by_month_and_distance_category.csv"
)

# Agréger les données par type de retard et par catégorie de distance
agregated_data = data_prep.agregate_data(
    data=table,
    group_by_columns=['distance_category'],
    agg_dict={
        'bool_carrier_delay_min': 'sum',
        'bool_weather_delay_min': 'sum',
        'bool_traffic_delay_min': 'sum',
        'bool_security_delay_min': 'sum',
        'bool_late_aircraft_delay_min': 'sum',
        'is_late': 'sum',
        'cancelled': 'sum',
        'flight_number': 'count'
    },
    filepath=f"{data_folder_delphine}/aggregated_by_late_type_and_distance_category.csv"
)


'''
Agrégations pour Léo
'''

# Agréger les données par semaine et par ville d'origine
agregated_data = data_prep.agregate_data(
    data=table,
    group_by_columns=['week_number', 'origin_city'],
    agg_dict={
        'bool_carrier_delay_min': 'sum',
        'bool_weather_delay_min': 'sum',
        'bool_traffic_delay_min': 'sum',
        'bool_security_delay_min': 'sum',
        'bool_late_aircraft_delay_min': 'sum',
        'is_late': 'sum',
        'cancelled': 'sum',
        'flight_number': 'count'
    },
    filepath=f"{data_folder_leo}/aggregated_by_week_and_origin_city.csv"
)

# Agréger les données par mois et par ville d'origine
agregated_data = data_prep.agregate_data(
    data=table,
    group_by_columns=['month', 'origin_city'],
    agg_dict={
        'bool_carrier_delay_min': 'sum',
        'bool_weather_delay_min': 'sum',
        'bool_traffic_delay_min': 'sum',
        'bool_security_delay_min': 'sum',
        'bool_late_aircraft_delay_min': 'sum',
        'is_late': 'sum',
        'cancelled': 'sum',
        'flight_number': 'count'
    },
    filepath=f"{data_folder_leo}/aggregated_by_month_and_origin_city.csv"
)



# Agréger les données par semaine et par ville d'arrivée
agregated_data = data_prep.agregate_data(
    data=table,
    group_by_columns=['week_number', 'dest_city'],
    agg_dict={
        'bool_carrier_delay_min': 'sum',
        'bool_weather_delay_min': 'sum',
        'bool_traffic_delay_min': 'sum',
        'bool_security_delay_min': 'sum',
        'bool_late_aircraft_delay_min': 'sum',
        'is_late': 'sum',
        'cancelled': 'sum',
        'flight_number': 'count'
    },
    filepath=f"{data_folder_leo}/aggregated_by_week_and_dest_city.csv"
)

# Agréger les données par mois et par ville d'arrivée
agregated_data = data_prep.agregate_data(
    data=table,
    group_by_columns=['month', 'dest_city'],
    agg_dict={
        'bool_carrier_delay_min': 'sum',
        'bool_weather_delay_min': 'sum',
        'bool_traffic_delay_min': 'sum',
        'bool_security_delay_min': 'sum',
        'bool_late_aircraft_delay_min': 'sum',
        'is_late': 'sum',
        'cancelled': 'sum',
        'flight_number': 'count'
    },
    filepath=f"{data_folder_leo}/aggregated_by_month_and_dest_city.csv"
)



'''
Agrégations pour Credo
'''

# Agréger les données par semaine et par itinéraire
agregated_data = data_prep.agregate_data(
    data=table,
    group_by_columns=['week_number', 'origin_city', 'dest_city'],
    agg_dict={
        'is_late': 'sum',
        'cancelled': 'sum',
        'flight_number': 'count'
    },
    filepath=f"{data_folder_credo}/aggregated_by_week_and_route.csv"
)

# Agréger les données par mois et par itinéraire
agregated_data = data_prep.agregate_data(
    data=table,
    group_by_columns=['month', 'origin_city', 'dest_city'],
    agg_dict={
        'is_late': 'sum',
        'cancelled': 'sum',
        'flight_number': 'count'
    },
    filepath=f"{data_folder_credo}/aggregated_by_month_and_route.csv"
)

# Agréger les données par type de retard et par itinéraire
agregated_data = data_prep.agregate_data(
    data=table,
    group_by_columns=['origin_city', 'dest_city'],
    agg_dict={
        'bool_carrier_delay_min': 'sum',
        'bool_weather_delay_min': 'sum',
        'bool_traffic_delay_min': 'sum',
        'bool_security_delay_min': 'sum',
        'bool_late_aircraft_delay_min': 'sum',
        'is_late': 'sum',
        'cancelled': 'sum',
        'flight_number': 'count'
    },
    filepath=f"{data_folder_credo}/aggregated_by_late_type_and_route.csv"
)


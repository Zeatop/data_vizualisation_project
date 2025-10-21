

class DataPreparation():

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
    def delete_useless_columns(data, columns_to_delete):
        for column in columns_to_delete:
            if column in data.columns:
                data = data.drop(columns=column, axis='columns')
        print("Colonnes après suppression:")
        print(data.head())
        return data
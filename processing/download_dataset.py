import kagglehub
import os


def download_dataset(data_folder):

    if not os.path.join(data_folder, "flight-data-2024.csv") in os.listdir(data_folder):
        
        path = kagglehub.dataset_download("hrishitpatil/flight-data-2024")

        # Find and copy only CSV files
        for file in os.listdir(path):
            if file.endswith('.csv'):
                source = os.path.join(path, file)
                destination = os.path.join(data_folder, file)

                # Copy file
                with open(source, 'rb') as src:
                    with open(destination, 'wb') as dst:
                        dst.write(src.read())

                print(f"Downloaded: {file} to {data_folder}")
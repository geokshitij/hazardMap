# Landslide Hazard Map using Earth Engine 
This code exports a Landslide Hazard Map using Earth Engine. The purpose of this code is to create a probability map that predicts the occurrence of landslides in a study area using a Random Forest model. The code uses various Earth Engine datasets such as NASA_USDA/HSL/soil_moisture, USGS/SRTMGL1_003, ESA/GLOBCOVER_L4_200901_200912_V2_3, CSP/ERGo/1_0/Global/ALOS_landforms, CSP/ERGo/1_0/Global/ALOS_topoDiversity, CSP/ERGo/1_0/Global/ALOS_mTPI, and UCSB-CHG/CHIRPS/PENTAD.

## Inputs
The function **exportLandslideHazardMap(slide, nslide, boundary, name)** takes four inputs:

1. slide: Landslide dataset
2. nslide: Non-landslide dataset
3. boundary: Study area boundary
4. name: Name of the output file

## Outputs
The function exports a Landslide Hazard Map as a **GeoTIFF** file.

## Methodology

1. Inventory preparation: Randomly split the landslide and non-landslide data into training and testing sets.
2. Pre-disposing factors preparation: Prepare the pre-disposing factors such as soil moisture, rainfall, elevation, slope, topographic diversity, and terrain roughness.
3. Stacking all pre-disposing factors: Stack all the pre-disposing factors together to form a single image.
4. Data sampling and model setup: Sample the training data and train a Random Forest model on the training data. Use the model to predict the probability of landslide occurrence for each pixel in the study area.
5. Export and visualization: Export the Landslide Hazard Map and visualize it using a custom color palette. Also, plot the Variable Importance and ROC-AUC curves to evaluate the performance of the model.

## Cite this work
**Rocky Talchabhadel, Shreedhar Maskey, Manish R. Gouli, Kshitij Dahal, Amrit Thapa, Sanjib Sharma, Amod M. Dixit, and Saurav Kumar. "Multimodal multiscale characterization of cascading hazard on mountain terrain." Geomatics, Natural Hazards and Risk 14, no. 1 (2023): 2162443. doi: 10.1080/19475705.2022.2162443.**

### Read the paper at [link](https://www.tandfonline.com/doi/full/10.1080/19475705.2022.2162443).


// This code is written by Kshitij Dahal and can be contacted at geokshitij@gmail.com.
// The purpose of this code is to export a Landslide Hazard Map using Earth Engine.

// - The code uses various Earth Engine datasets such as NASA_USDA/HSL/soil_moisture, USGS/SRTMGL1_003, ESA/GLOBCOVER_L4_200901_200912_V2_3, CSP/ERGo/1_0/Global/ALOS_landforms, CSP/ERGo/1_0/Global/ALOS_topoDiversity, CSP/ERGo/1_0/Global/ALOS_mTPI, and UCSB-CHG/CHIRPS/PENTAD.
// - The Landslide Hazard Map is created using a Random Forest model trained on pre-disposing factors such as soil moisture, rainfall, elevation, slope, topographic diversity, and terrain roughness.
// - The training data is prepared by randomly splitting the landslide and non-landslide data into training and testing sets.
// - The pre-disposing factors are stacked together and the Random Forest model is trained on the training data.
// - The model is used to predict the probability of landslide occurrence for each pixel in the study area.
// - The Landslide Hazard Map is exported and visualized using a custom color palette.
// - The Variable Importance and ROC-AUC curves are also plotted to evaluate the performance of the model.


function exportLandslideHazardMap(slide, nslide, boundary, name) {
  var SMAP = ee.ImageCollection("NASA_USDA/HSL/soil_moisture");
  var SRTM = ee.Image("USGS/SRTMGL1_003");
  var LULC = ee.Image("ESA/GLOBCOVER_L4_200901_200912_V2_3");
  var Alos = ee.Image("CSP/ERGo/1_0/Global/ALOS_landforms");
  var alosTopo = ee.Image("CSP/ERGo/1_0/Global/ALOS_topoDiversity");
  var TPI = ee.Image("CSP/ERGo/1_0/Global/ALOS_mTPI");
  var CHIRPS = ee.ImageCollection("UCSB-CHG/CHIRPS/PENTAD");
 
  var LSM_visualization = {
    "opacity": 1,
    "bands": ["classification"],
    "min": 0.13324677385389805,
    "max": 0.7938361559063196,
    "palette": ["24ff0a", "e1ffca", "fff79d", "ffe425", "ff8164", "ff2806"]
  };
  
  // 1. Inventory preparation
  
  var withRandom = slide.randomColumn('random');
  var split = 0.7;  
  var tr_slide = withRandom.filter(ee.Filter.lt('random', split));
  var ts_slide = withRandom.filter(ee.Filter.gte('random', split));
  
  var nwithRandom = nslide.randomColumn('random');
  var nsplit = 0.7; 
  var tr_nslide = nwithRandom.filter(ee.Filter.lt('random', nsplit));
  var ts_nslide = nwithRandom.filter(ee.Filter.gte('random', nsplit));
  
  // Merge training data, the other data is kept for testing AuC
  var trainingfc= tr_slide.merge(tr_nslide);
  
  // 2. Pre-disposing factors preparation--
    
  var ssm = SMAP.select('ssm').mean();
  var susm = SMAP.select('susm').mean();
  
  var rainMean = CHIRPS.mean();
  var rainMax = CHIRPS.max();
  
  var elevation = SRTM;
  var slope = ee.Terrain.slope(SRTM);
  
  var alosTopographicDiversity = alosTopo.select('constant');
  
  var alosMtpi = TPI.select('AVE');
  
  // 3. Stacking all pre-disposing factors
  
  var parameters = ssm.addBands(susm.rename(["susm"]))
  .addBands(rainMean.rename(["rainMean"]))
  .addBands(rainMax.rename(["rainMax"]))
  .addBands(elevation.rename(["elevation"]))
  .addBands(slope.rename(["slope"]))
  .addBands(alosTopographicDiversity.rename(["alosTopographicDiversity"]))
  .addBands(alosMtpi.rename(["alosMtpi"]));
  
  
  // 4. Data sampling and model setup
  
  var bands = ['ssm','susm','rainMean','rainMax','elevation','slope',
               'alosTopographicDiversity','alosMtpi'];
  
  var training= parameters.select(bands).sampleRegions({
    collection: trainingfc,properties: ['slide'],scale: 90 });
  
  // The random forest model
  var classifier = ee.Classifier.smileRandomForest(10).setOutputMode('PROBABILITY').train({
    features: training,classProperty: 'slide',inputProperties: bands });
  
  var probability = parameters.select(bands).classify(classifier);
  
  var temp_prob = probability.multiply(100);
  
  var map_export = temp_prob.toByte();
  
  var dict = classifier.explain();
  // print('Explain:',dict);
  
  var variable_importance = ee.Feature(
    null, ee.Dictionary(dict).get('importance')
  );
  
  var chart = ui.Chart.feature.byProperty(variable_importance)
  .setChartType('ColumnChart')
  .setOptions({
    title: name+'_variable importance',
    legend: { position: 'none' },
    hAxis: { title: 'Parameter' },
    vAxis: { title: 'Importance' }
  });
  
  print(chart);
  
  // ref by Guy Ziv: https://groups.google.com/d/msg/google-earth-engine-developers/52ASlA15yLg/E3exyfyTGQAJ
  
  var error = ee.Dictionary(dict).get('outOfBagErrorEstimate');
  print('out Of Bag Error Estimate:', error);
  
  Map.addLayer(probability.clip(boundary),LSM_visualization,name+'_landslide Susceptibility',true);
  
  // ROC - AUC analysis
  
  var SLIDE = probability.reduceRegions(ts_slide, ee.Reducer.max().setOutputs(['susc']), 100)
  .map(function(x) {
    return x.set('is_target', 1);
  });
  
  var NSLIDE = probability.reduceRegions(ts_nslide, ee.Reducer.max().setOutputs(['susc']), 100)
  .map(function(x) {
    return x.set('is_target', 0);
  });
  
  var combined = SLIDE.merge(NSLIDE);
  
  var ROC_field = 'susc',
  ROC_min = 0,
  ROC_max = 1,
  ROC_steps = 1000,
  ROC_points = combined;
  
  var ROC = ee.FeatureCollection(
    ee.List.sequence(ROC_min, ROC_max, null, ROC_steps).map(function(cutoff) {
      var target_roc = ROC_points.filterMetadata('is_target', 'equals', 1);
      // true-positive-rate, sensitivity  
      var TPR = ee.Number(target_roc.filterMetadata(ROC_field, 'greater_than', cutoff).size())
      .divide(target_roc.size());
      
      var non_target_roc = ROC_points.filterMetadata('is_target', 'equals', 0);
      // true-negative-rate, specificity  
      var TNR = ee.Number(non_target_roc.filterMetadata(ROC_field, 'less_than', cutoff).size())
      .divide(non_target_roc.size());
      
      return ee.Feature(null, {
        cutoff: cutoff,
        TPR: TPR,
        TNR: TNR,
        FPR: TNR.subtract(1).multiply(-1),
        dist: TPR.subtract(1).pow(2).add(TNR.subtract(1).pow(2)).sqrt()
      });
    })
  );
  
  // Use trapezoidal approximation for area under curve (AUC)
  var X = ee.Array(ROC.aggregate_array('FPR')),
  Y = ee.Array(ROC.aggregate_array('TPR')),
  Xk_m_Xkm1 = X.slice(0, 1).subtract(X.slice(0, 0, -1)),
  Yk_p_Ykm1 = Y.slice(0, 1).add(Y.slice(0, 0, -1)),
  AUC = Xk_m_Xkm1.multiply(Yk_p_Ykm1).multiply(0.5).reduce('sum', [0]).abs().toList().get(0);
  
  print(AUC, 'Area under curve');
  
  // Plot the ROC curve
  print(ui.Chart.feature.byFeature(ROC, 'FPR', 'TPR').setOptions({
    title: 'ROC curve',
    legend: 'none',
    hAxis: { title: 'False-positive-rate' },
    vAxis: { title: 'True-negative-rate' },
    lineWidth: 2
  }));
  
  // find the cutoff value whose ROC point is closest to (0,1) (= "perfect classification") 
  var ROC_best = ROC.sort('dist').first().get('cutoff').aside(print, 'best ROC point cutoff'); 
  
  
  // 6. Batch mode export
  
  Export.image.toDrive({
    image: map_export.clip(boundary),
    description: name + '_hazard_map',
    scale: 30,
    region: boundary,
    folder: 'hazardMap',
    maxPixels: 1e13,
    fileFormat: 'GeoTIFF'
  });
  
  // Export the model, this includes trees, variable importance and obg error
  var forExport = ee.List(dict.keys()).map(function(i){
    return ee.Feature(null).set('key', ee.String(i), 'value', dict.get(i));
  });
  forExport = ee.FeatureCollection(forExport);


  // Export the model to Google Drive
  Export.table.toDrive({
    collection: forExport,
    description: name + '_hazard_map_model',
    folder: 'hazardMap',
    fileFormat: 'CSV'
  });

  // Export the ROC curve to Google Drive
  Export.table.toDrive({
    collection: ROC,
    description: name + '_hazard_map_ROC',
    folder: 'hazardMap',
    fileFormat: 'CSV'
  });
  
  return(map_export.clip(boundary));
  
}

exports.exportLandslideHazardMap = exportLandslideHazardMap;


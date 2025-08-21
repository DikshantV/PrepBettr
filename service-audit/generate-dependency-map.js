#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Generate Graphviz DOT file from Firebase and Azure scan data
 */
function generateDependencyGraph() {
  const firebaseData = JSON.parse(fs.readFileSync('raw-scan/firebase.json', 'utf8'));
  const azureData = JSON.parse(fs.readFileSync('raw-scan/azure.json', 'utf8'));

  const layers = {
    frontend: ['app/', 'components/', 'contexts/', 'hooks/'],
    backend: ['azure/', 'functions/', 'pages/api/'],
    shared: ['lib/', 'firebase/', 'types/', 'constants/']
  };

  function getLayer(filePath) {
    for (const [layer, prefixes] of Object.entries(layers)) {
      if (prefixes.some(prefix => filePath.startsWith('./' + prefix))) {
        return layer;
      }
    }
    return 'other';
  }

  function getNodeColor(layer) {
    const colors = {
      frontend: '#3B82F6', // Blue
      backend: '#10B981',  // Green  
      shared: '#8B5CF6',   // Purple
      other: '#6B7280'     // Gray
    };
    return colors[layer] || colors.other;
  }

  function sanitizeNodeName(filePath) {
    return filePath.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  let dotContent = `digraph ServiceDependencies {
  rankdir=TB;
  node [shape=box, style=filled, fontname="Arial", fontsize=10];
  edge [fontname="Arial", fontsize=8];
  
  // Subgraphs for layers
  subgraph cluster_frontend {
    label="Frontend Layer";
    style=filled;
    color=lightblue;
    fontsize=12;
    fontname="Arial Bold";
`;

  // Add nodes by layer
  const allFiles = new Set([...firebaseData.files, ...azureData.files]);
  const nodesByLayer = { frontend: [], backend: [], shared: [], other: [] };

  allFiles.forEach(file => {
    const layer = getLayer(file);
    nodesByLayer[layer].push(file);
  });

  // Frontend nodes
  nodesByLayer.frontend.forEach(file => {
    const nodeName = sanitizeNodeName(file);
    const shortName = file.split('/').pop() || file;
    dotContent += `    ${nodeName} [label="${shortName}", color="${getNodeColor('frontend')}"];\n`;
  });

  dotContent += `  }
  
  subgraph cluster_backend {
    label="Backend Layer";
    style=filled;
    color=lightgreen;
    fontsize=12;
    fontname="Arial Bold";
`;

  // Backend nodes
  nodesByLayer.backend.forEach(file => {
    const nodeName = sanitizeNodeName(file);
    const shortName = file.split('/').pop() || file;
    dotContent += `    ${nodeName} [label="${shortName}", color="${getNodeColor('backend')}"];\n`;
  });

  dotContent += `  }
  
  subgraph cluster_shared {
    label="Shared Library Layer";
    style=filled;
    color=lightpink;
    fontsize=12;
    fontname="Arial Bold";
`;

  // Shared nodes
  nodesByLayer.shared.forEach(file => {
    const nodeName = sanitizeNodeName(file);
    const shortName = file.split('/').pop() || file;
    dotContent += `    ${nodeName} [label="${shortName}", color="${getNodeColor('shared')}"];\n`;
  });

  dotContent += `  }

  // Service dependency nodes
  firebase_services [label="Firebase Services", shape=ellipse, color="#FF6B35", style=filled];
  azure_services [label="Azure Services", shape=ellipse, color="#0078D4", style=filled];

  // Dependencies
`;

  // Add Firebase dependencies
  const firebaseImportsByFile = {};
  firebaseData.imports.forEach(imp => {
    if (!firebaseImportsByFile[imp.file]) {
      firebaseImportsByFile[imp.file] = [];
    }
    firebaseImportsByFile[imp.file].push(imp.import);
  });

  Object.entries(firebaseImportsByFile).forEach(([file, imports]) => {
    const nodeName = sanitizeNodeName(file);
    dotContent += `  ${nodeName} -> firebase_services [label="${imports.length} imports", color=red];\n`;
  });

  // Add Azure dependencies
  const azureImportsByFile = {};
  azureData.imports.forEach(imp => {
    if (!azureImportsByFile[imp.file]) {
      azureImportsByFile[imp.file] = [];
    }
    azureImportsByFile[imp.file].push(imp.import);
  });

  Object.entries(azureImportsByFile).forEach(([file, imports]) => {
    const nodeName = sanitizeNodeName(file);
    dotContent += `  ${nodeName} -> azure_services [label="${imports.length} imports", color=blue];\n`;
  });

  dotContent += `
  // Legend
  subgraph cluster_legend {
    label="Legend";
    style=filled;
    color=lightyellow;
    fontsize=10;
    
    legend_frontend [label="Frontend", color="${getNodeColor('frontend')}", style=filled];
    legend_backend [label="Backend", color="${getNodeColor('backend')}", style=filled];
    legend_shared [label="Shared Lib", color="${getNodeColor('shared')}", style=filled];
    
    legend_frontend -> legend_backend [style=invis];
    legend_backend -> legend_shared [style=invis];
  }
}`;

  return dotContent;
}

// Generate dependency statistics
function generateDependencyStats() {
  const firebaseData = JSON.parse(fs.readFileSync('raw-scan/firebase.json', 'utf8'));
  const azureData = JSON.parse(fs.readFileSync('raw-scan/azure.json', 'utf8'));

  const stats = {
    firebase: {
      totalFiles: firebaseData.files.length,
      imports: firebaseData.imports.length,
      services: {},
      topFiles: {}
    },
    azure: {
      totalFiles: azureData.files.length,
      imports: azureData.imports.length,
      services: {},
      topFiles: {}
    }
  };

  // Count Firebase services
  firebaseData.services.forEach(service => {
    stats.firebase.services[service.service] = (stats.firebase.services[service.service] || 0) + 1;
  });

  // Count Azure services
  azureData.services.forEach(service => {
    stats.azure.services[service.service] = (stats.azure.services[service.service] || 0) + 1;
  });

  // Count files by usage
  firebaseData.imports.forEach(imp => {
    stats.firebase.topFiles[imp.file] = (stats.firebase.topFiles[imp.file] || 0) + 1;
  });

  azureData.imports.forEach(imp => {
    stats.azure.topFiles[imp.file] = (stats.azure.topFiles[imp.file] || 0) + 1;
  });

  return stats;
}

// Generate the DOT file and stats
const dotContent = generateDependencyGraph();
const stats = generateDependencyStats();

fs.writeFileSync('graphs/dependencies.dot', dotContent);
fs.writeFileSync('graphs/dependency-stats.json', JSON.stringify(stats, null, 2));

console.log('✅ Dependency map generated');
console.log('📊 Statistics:');
console.log(`   Firebase: ${stats.firebase.totalFiles} files, ${stats.firebase.imports} imports`);
console.log(`   Azure: ${stats.azure.totalFiles} files, ${stats.azure.imports} imports`);
console.log('📋 Files generated:');
console.log('   - graphs/dependencies.dot');
console.log('   - graphs/dependency-stats.json');
console.log('🎯 To generate PNG: dot -Tpng graphs/dependencies.dot -o graphs/dependencies.png');

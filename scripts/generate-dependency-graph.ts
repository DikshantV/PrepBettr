#!/usr/bin/env tsx

/**
 * Azure AI Foundry Dependency Graph Generator
 * 
 * Creates visual dependency graphs showing relationships between
 * Foundry modules and identifies critical paths and bottlenecks.
 * 
 * Usage: npm run foundry:deps:graph
 */

import { promises as fs } from 'fs';
import { join, relative, dirname } from 'path';

interface ModuleDependency {
  source: string;
  target: string;
  type: 'import' | 'call' | 'extends' | 'implements';
  line?: number;
}

interface DependencyGraph {
  nodes: {
    id: string;
    label: string;
    type: 'client' | 'service' | 'component' | 'utility' | 'config' | 'types';
    complexity: 'low' | 'medium' | 'high';
    priority: 'low' | 'medium' | 'high' | 'critical';
    hasTests: boolean;
  }[];
  edges: ModuleDependency[];
  clusters: {
    id: string;
    label: string;
    nodes: string[];
  }[];
}

class DependencyGraphGenerator {
  private rootDir: string;
  private graph: DependencyGraph;

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = rootDir;
    this.graph = {
      nodes: [],
      edges: [],
      clusters: []
    };
  }

  async generateGraph(): Promise<DependencyGraph> {
    console.log('🔍 Analyzing Azure AI Foundry module dependencies...');
    
    const foundryFiles = await this.findFoundryFiles();
    console.log(`📦 Found ${foundryFiles.length} Foundry modules`);

    // Analyze each file
    for (const file of foundryFiles) {
      await this.analyzeFile(file);
    }

    // Create clusters
    this.createClusters();

    // Calculate metrics
    this.calculateMetrics();

    console.log('📊 Dependency graph generated successfully');
    return this.graph;
  }

  private async findFoundryFiles(): Promise<string[]> {
    const files: string[] = [];
    const searchPaths = [
      'lib/azure-ai-foundry',
      'src/lib/azure-ai-foundry',
      'components/FoundryVoiceAgent.tsx'
    ];

    for (const searchPath of searchPaths) {
      const fullPath = join(this.rootDir, searchPath);
      try {
        await this.walkDirectory(fullPath, files);
      } catch (error) {
        // Directory doesn't exist, skip
      }
    }

    return files.filter(f => 
      (f.endsWith('.ts') || f.endsWith('.tsx')) &&
      !f.includes('node_modules') &&
      !f.includes('.test.') &&
      !f.includes('.spec.')
    );
  }

  private async walkDirectory(dir: string, files: string[]): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await this.walkDirectory(fullPath, files);
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip inaccessible directories
    }
  }

  private async analyzeFile(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const relativePath = relative(this.rootDir, filePath);
      
      // Create node
      const node = {
        id: relativePath,
        label: this.getModuleName(relativePath),
        type: this.determineModuleType(relativePath, content),
        complexity: this.calculateComplexity(content),
        priority: this.determinePriority(relativePath, content),
        hasTests: await this.hasTests(relativePath)
      };

      this.graph.nodes.push(node);

      // Extract dependencies
      const dependencies = this.extractDependencies(content, relativePath);
      this.graph.edges.push(...dependencies);

    } catch (error) {
      console.warn(`⚠️ Failed to analyze ${filePath}:`, error);
    }
  }

  private getModuleName(path: string): string {
    const parts = path.split('/');
    const filename = parts[parts.length - 1];
    return filename.replace(/\.(ts|tsx)$/, '');
  }

  private determineModuleType(path: string, content: string): DependencyGraph['nodes'][0]['type'] {
    if (path.includes('client') || content.includes('class') && content.includes('Client')) {
      return 'client';
    }
    if (path.includes('service') || content.includes('Service')) {
      return 'service';
    }
    if (path.includes('component') || path.includes('.tsx')) {
      return 'component';
    }
    if (path.includes('config') || path.includes('types')) {
      return path.includes('config') ? 'config' : 'types';
    }
    return 'utility';
  }

  private calculateComplexity(content: string): 'low' | 'medium' | 'high' {
    const lines = content.split('\n').length;
    const functions = (content.match(/function|=>/g) || []).length;
    const classes = (content.match(/class /g) || []).length;
    const complexity = lines * 0.1 + functions * 2 + classes * 5;

    if (complexity > 100) return 'high';
    if (complexity > 50) return 'medium';
    return 'low';
  }

  private determinePriority(path: string, content: string): 'low' | 'medium' | 'high' | 'critical' {
    // Critical modules
    if (path.includes('foundry-client') ||
        path.includes('base-agent') ||
        path.includes('voice-session') ||
        path.includes('model-manager')) {
      return 'critical';
    }
    
    // High priority modules
    if (this.determineModuleType(path, content) === 'client' ||
        this.determineModuleType(path, content) === 'service') {
      return 'high';
    }
    
    return 'medium';
  }

  private async hasTests(modulePath: string): Promise<boolean> {
    const testPaths = [
      modulePath.replace(/\.(ts|tsx)$/, '.test.ts'),
      modulePath.replace(/\.(ts|tsx)$/, '.test.tsx'),
      modulePath.replace(/\.(ts|tsx)$/, '.spec.ts'),
      `tests/unit/${modulePath.replace(/\.(ts|tsx)$/, '.test.ts')}`,
      `tests/integration/${modulePath.replace(/\.(ts|tsx)$/, '.test.ts')}`
    ];

    for (const testPath of testPaths) {
      try {
        await fs.access(join(this.rootDir, testPath));
        return true;
      } catch {
        // Test doesn't exist
      }
    }

    return false;
  }

  private extractDependencies(content: string, sourcePath: string): ModuleDependency[] {
    const dependencies: ModuleDependency[] = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Import statements
      const importMatch = line.match(/import.*?from\s+['"](.*?)['"];?/);
      if (importMatch) {
        const importPath = importMatch[1];
        if (this.isFoundryModule(importPath)) {
          dependencies.push({
            source: sourcePath,
            target: this.resolveImportPath(importPath, sourcePath),
            type: 'import',
            line: index + 1
          });
        }
      }

      // Class extensions
      const extendsMatch = line.match(/class\s+\w+\s+extends\s+(\w+)/);
      if (extendsMatch) {
        const className = extendsMatch[1];
        const targetModule = this.findModuleByClassName(className);
        if (targetModule) {
          dependencies.push({
            source: sourcePath,
            target: targetModule,
            type: 'extends',
            line: index + 1
          });
        }
      }
    });

    return dependencies;
  }

  private isFoundryModule(importPath: string): boolean {
    return importPath.includes('azure-ai-foundry') ||
           importPath.includes('foundry') ||
           importPath.includes('./') ||
           importPath.includes('../');
  }

  private resolveImportPath(importPath: string, fromPath: string): string {
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      // Relative import - resolve based on current file location
      const fromDir = dirname(fromPath);
      return join(fromDir, importPath).replace(/\\/g, '/');
    }
    
    if (importPath.includes('azure-ai-foundry')) {
      // Absolute foundry import
      return importPath.replace('@/', '').replace(/^\//, '');
    }

    return importPath;
  }

  private findModuleByClassName(className: string): string | null {
    for (const node of this.graph.nodes) {
      if (node.label.includes(className)) {
        return node.id;
      }
    }
    return null;
  }

  private createClusters(): void {
    const clusterMap = new Map<string, string[]>();

    this.graph.nodes.forEach(node => {
      const pathParts = node.id.split('/');
      
      // Group by main directory
      let clusterKey: string;
      if (pathParts[0] === 'lib' && pathParts[1] === 'azure-ai-foundry') {
        clusterKey = `Foundation Layer (${pathParts[2] || 'core'})`;
      } else if (pathParts[0] === 'src' && pathParts[1] === 'lib' && pathParts[2] === 'azure-ai-foundry') {
        clusterKey = `${pathParts[3] ? pathParts[3].charAt(0).toUpperCase() + pathParts[3].slice(1) : 'Core'} Layer`;
      } else if (pathParts[0] === 'components') {
        clusterKey = 'UI Components';
      } else {
        clusterKey = 'Other';
      }

      if (!clusterMap.has(clusterKey)) {
        clusterMap.set(clusterKey, []);
      }
      clusterMap.get(clusterKey)!.push(node.id);
    });

    this.graph.clusters = Array.from(clusterMap.entries()).map(([label, nodes], index) => ({
      id: `cluster_${index}`,
      label,
      nodes
    }));
  }

  private calculateMetrics(): void {
    const metrics = {
      totalModules: this.graph.nodes.length,
      totalDependencies: this.graph.edges.length,
      modulesWithTests: this.graph.nodes.filter(n => n.hasTests).length,
      criticalModules: this.graph.nodes.filter(n => n.priority === 'critical').length,
      highComplexityModules: this.graph.nodes.filter(n => n.complexity === 'high').length
    };

    console.log('\n📊 Dependency Graph Metrics:');
    console.log(`   Total Modules: ${metrics.totalModules}`);
    console.log(`   Total Dependencies: ${metrics.totalDependencies}`);
    console.log(`   Modules with Tests: ${metrics.modulesWithTests}/${metrics.totalModules} (${Math.round(metrics.modulesWithTests/metrics.totalModules*100)}%)`);
    console.log(`   Critical Modules: ${metrics.criticalModules}`);
    console.log(`   High Complexity Modules: ${metrics.highComplexityModules}`);
  }

  async saveGraph(outputPath: string): Promise<void> {
    await fs.mkdir(dirname(outputPath), { recursive: true });
    
    // Save JSON
    await fs.writeFile(outputPath, JSON.stringify(this.graph, null, 2));
    
    // Save Mermaid diagram
    const mermaidPath = outputPath.replace('.json', '.mmd');
    const mermaidDiagram = this.generateMermaidDiagram();
    await fs.writeFile(mermaidPath, mermaidDiagram);

    // Save DOT graph  
    const dotPath = outputPath.replace('.json', '.dot');
    const dotGraph = this.generateDotGraph();
    await fs.writeFile(dotPath, dotGraph);

    console.log(`💾 Graph saved to:`);
    console.log(`   JSON: ${outputPath}`);
    console.log(`   Mermaid: ${mermaidPath}`);
    console.log(`   DOT: ${dotPath}`);
  }

  private generateMermaidDiagram(): string {
    let mermaid = 'flowchart TB\n';

    // Add clusters/subgraphs
    this.graph.clusters.forEach(cluster => {
      mermaid += `  subgraph ${cluster.id}["${cluster.label}"]\n`;
      cluster.nodes.forEach(nodeId => {
        const node = this.graph.nodes.find(n => n.id === nodeId);
        if (node) {
          const shape = this.getMermaidShape(node);
          const style = node.hasTests ? 'fill:#90EE90' : node.priority === 'critical' ? 'fill:#FFB6C1' : '';
          mermaid += `    ${this.sanitizeId(nodeId)}${shape}\n`;
          if (style) {
            mermaid += `    style ${this.sanitizeId(nodeId)} ${style}\n`;
          }
        }
      });
      mermaid += '  end\n';
    });

    // Add dependencies
    this.graph.edges.forEach(edge => {
      const arrow = this.getMermaidArrow(edge.type);
      mermaid += `  ${this.sanitizeId(edge.source)} ${arrow} ${this.sanitizeId(edge.target)}\n`;
    });

    return mermaid;
  }

  private getMermaidShape(node: DependencyGraph['nodes'][0]): string {
    const label = node.label.length > 15 ? node.label.substring(0, 12) + '...' : node.label;
    switch (node.type) {
      case 'client': return `[["${label}"]]`;
      case 'service': return `(("${label}"))`;
      case 'component': return `{"${label}"}`;
      case 'config': return `[("${label}")]`;
      case 'types': return `("${label}")`;
      default: return `["${label}"]`;
    }
  }

  private getMermaidArrow(type: string): string {
    switch (type) {
      case 'extends': return '==>'; 
      case 'implements': return '-.->';
      case 'call': return '-->';
      default: return '-->'; // import
    }
  }

  private sanitizeId(id: string): string {
    return id.replace(/[^a-zA-Z0-9]/g, '_');
  }

  private generateDotGraph(): string {
    let dot = 'digraph FoundryDependencies {\n';
    dot += '  rankdir=TB;\n';
    dot += '  node [shape=box, style=filled];\n\n';

    // Add nodes
    this.graph.nodes.forEach(node => {
      const color = node.hasTests ? 'lightgreen' : 
                    node.priority === 'critical' ? 'lightpink' : 
                    node.complexity === 'high' ? 'lightyellow' : 'white';
      dot += `  "${node.id}" [label="${node.label}", fillcolor=${color}];\n`;
    });

    dot += '\n';

    // Add edges
    this.graph.edges.forEach(edge => {
      const style = edge.type === 'extends' ? 'bold' : 'solid';
      dot += `  "${edge.source}" -> "${edge.target}" [style=${style}];\n`;
    });

    dot += '}';
    return dot;
  }
}

async function main() {
  try {
    const generator = new DependencyGraphGenerator();
    const graph = await generator.generateGraph();
    
    const outputPath = join(process.cwd(), 'audit-results', 'foundry-dependency-graph.json');
    await generator.saveGraph(outputPath);

    console.log('\n✅ Dependency graph generation complete!');
  } catch (error) {
    console.error('❌ Failed to generate dependency graph:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { DependencyGraphGenerator };

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { UploadCloud, FileSpreadsheet, Loader2, Lightbulb, Presentation, RefreshCw, BarChart3, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeData } from './services/gemini';
import { ChartRenderer } from './components/ChartRenderer';
// @ts-ignore
import html2pdf from 'html2pdf.js';

export default function App() {
  const [data, setData] = useState<any[] | null>(null);
  const [analysis, setAnalysis] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        throw new Error("The uploaded Excel file is empty.");
      }

      setData(jsonData);

      // Pass the full dataset to analyzeData (it handles sampling internally for speed)
      const result = await analyzeData(jsonData);
      setAnalysis(result);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred while processing the file.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setData(null);
    setAnalysis(null);
    setError(null);
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!reportRef.current) return;
    
    setDownloading(true);
    
    try {
      const element = reportRef.current;
      element.classList.add('pdf-mode');
      
      const opt = {
        margin: 10 as number,
        filename: `Excel_Insights_Report_${new Date().getTime()}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          logging: false,
          backgroundColor: '#050505',
          onclone: (clonedDoc: Document) => {
            // 1. Inject a style tag to override modern colors globally in the clone
            const styleTag = clonedDoc.createElement('style');
            styleTag.innerHTML = `
              * {
                color-scheme: dark !important;
              }
              /* Aggressively override any potential oklch/oklab usage in common classes */
              .bg-indigo-500 { background-color: #6366f1 !important; }
              .bg-indigo-600 { background-color: #4f46e5 !important; }
              .bg-violet-600 { background-color: #7c3aed !important; }
              .bg-emerald-500 { background-color: #10b981 !important; }
              .bg-emerald-600 { background-color: #059669 !important; }
              .bg-red-500 { background-color: #ef4444 !important; }
              .bg-yellow-500 { background-color: #eab308 !important; }
              .text-indigo-400 { color: #818cf8 !important; }
              .text-indigo-300 { color: #a5b4fc !important; }
              .text-emerald-400 { color: #34d399 !important; }
              .text-red-400 { color: #f87171 !important; }
              .text-yellow-500 { color: #eab308 !important; }
              
              /* Force fallback for any oklch/oklab variables */
              :root {
                --tw-bg-opacity: 1 !important;
                --tw-text-opacity: 1 !important;
              }
              
              /* Remove all gradients in the clone as they often use oklch */
              [class*="bg-gradient-"] {
                background-image: none !important;
                background-color: #111111 !important;
              }
            `;
            clonedDoc.head.appendChild(styleTag);

            // 2. Nuclear option: Find all elements in the cloned doc and strip modern color functions
            // that html2canvas cannot parse.
            const elements = clonedDoc.getElementsByTagName('*');
            const colorProps = ['color', 'backgroundColor', 'borderColor', 'fill', 'stroke', 'stopColor', 'floodColor', 'outlineColor', 'backgroundImage'];
            
            for (let i = 0; i < elements.length; i++) {
              const el = elements[i] as HTMLElement;
              
              // 1. Check inline styles
              const style = el.style;
              colorProps.forEach(prop => {
                // @ts-ignore
                const val = style[prop];
                if (val && (val.includes('oklch') || val.includes('oklab'))) {
                  if (prop === 'backgroundImage') {
                    style.backgroundImage = 'none';
                  } else {
                    // @ts-ignore
                    style[prop] = prop.toLowerCase().includes('background') ? '#111111' : '#ffffff';
                  }
                }
              });

              // 2. Check computed styles and force overrides if they use oklch/oklab
              try {
                const computed = window.getComputedStyle(el);
                colorProps.forEach(prop => {
                  // @ts-ignore
                  const val = computed[prop];
                  if (val && (val.includes('oklch') || val.includes('oklab'))) {
                    if (prop === 'backgroundImage') {
                      el.style.setProperty('background-image', 'none', 'important');
                    } else {
                      // Force standard color via !important inline style on the clone
                      const fallback = prop.toLowerCase().includes('background') ? '#111111' : '#ffffff';
                      el.style.setProperty(prop.replace(/[A-Z]/g, m => "-" + m.toLowerCase()), fallback, 'important');
                    }
                  }
                });
              } catch (e) {
                // Ignore errors in getComputedStyle on cloned elements
              }
            }
          }
        },
        jsPDF: { unit: 'mm', format: 'a4' as const, orientation: 'portrait' as const }
      };

      // Generate PDF
      await html2pdf().set(opt).from(element).save();
      element.classList.remove('pdf-mode');
    } catch (err) {
      console.error('PDF Generation Error:', err);
      if (reportRef.current) {
        reportRef.current.classList.remove('pdf-mode');
      }
      // Fallback to print if html2pdf fails
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans p-4 md:p-8 selection:bg-indigo-500/30 overflow-x-hidden relative">
      {/* Ambient background glow */}
      <div className="fixed inset-0 z-0 pointer-events-none no-print">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-600/10 blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto space-y-8 relative z-10 print-container" ref={reportRef}>
        {/* Header */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-4 pb-6 border-b border-white/10 no-print relative z-20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <BarChart3 className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Excel Insights Pro</h1>
              <p className="text-sm text-white/50">AI-Powered Analytics Engine</p>
            </div>
          </div>
          {data && (
            <div className="flex items-center gap-3 relative z-30">
              <button 
                onClick={handleDownload}
                disabled={downloading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/50 disabled:cursor-not-allowed transition-all text-sm font-medium text-white shadow-lg shadow-indigo-500/20 cursor-pointer relative z-40 active:scale-95"
              >
                {downloading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Download size={16} />
                )}
                {downloading ? 'Generating PDF...' : 'Download Report'}
              </button>
              <button 
                onClick={reset}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-sm font-medium text-white/80 hover:text-white"
              >
                <RefreshCw size={16} /> New Analysis
              </button>
            </div>
          )}
        </header>

        {/* Print-only Header */}
        <div className="hidden print:block mb-8 border-b-2 border-gray-200 pb-4">
          <h1 className="text-3xl font-bold text-gray-900">Excel Insights Pro - Data Report</h1>
          <p className="text-gray-500 italic mt-1">Generated on {new Date().toLocaleDateString()}</p>
        </div>

        <AnimatePresence mode="wait">
          {!data && !loading && (
            <motion.div 
              key="upload"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-2xl mx-auto mt-20"
            >
              <div className="text-center mb-10">
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                  Visualize your data instantly
                </h2>
                <p className="text-lg text-white/50">
                  Upload your spreadsheet and let AI generate insights and beautiful charts in seconds.
                </p>
              </div>

              <label className="group relative flex flex-col items-center justify-center w-full h-72 rounded-[2rem] cursor-pointer overflow-hidden transition-all">
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent border-2 border-dashed border-white/10 group-hover:border-indigo-500/50 rounded-[2rem] transition-colors" />
                <div className="absolute inset-0 bg-indigo-500/0 group-hover:bg-indigo-500/5 transition-colors" />
                <div className="relative flex flex-col items-center justify-center pt-5 pb-6 z-10">
                  <div className="w-16 h-16 mb-6 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-500/20 transition-all duration-300 shadow-xl">
                    <UploadCloud className="w-8 h-8 text-white/60 group-hover:text-indigo-400 transition-colors" />
                  </div>
                  <p className="mb-2 text-lg text-white/80 font-medium">
                    <span className="text-indigo-400">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-sm text-white/40">Excel (.xlsx, .xls) or CSV files</p>
                </div>
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".xlsx, .xls, .csv" 
                  onChange={handleFileUpload}
                />
              </label>
              
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 p-4 bg-red-500/10 text-red-400 rounded-2xl text-sm border border-red-500/20 text-center"
                >
                  {error}
                </motion.div>
              )}
            </motion.div>
          )}

          {loading && (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-32 space-y-6"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 rounded-full animate-pulse" />
                <Loader2 className="w-12 h-12 text-indigo-400 animate-spin relative z-10" />
              </div>
              <p className="text-white/60 font-medium animate-pulse tracking-wide">Synthesizing data & generating presentation...</p>
            </motion.div>
          )}

          {data && analysis && !loading && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            >
              {/* Left Column: Summary & Insights (Bento) */}
              <div className="lg:col-span-4 space-y-6">
                {/* Summary Card */}
                <div className="p-6 rounded-3xl bg-[#111111] border border-white/5 shadow-2xl relative overflow-hidden print-card">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full no-print" />
                  <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2 print-label">
                    <Presentation size={14} /> Executive Summary
                  </h2>
                  <p className="text-lg leading-relaxed font-light text-white/90 print-text">
                    {analysis.summary}
                  </p>
                  <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between text-sm text-white/40 print-label">
                    <span>Dataset Size</span>
                    <span className="font-mono text-white/80 bg-white/5 px-2 py-1 rounded-md print-text">{data.length} rows</span>
                  </div>
                </div>

                {/* Insights Card */}
                <div className="p-6 rounded-3xl bg-gradient-to-b from-[#161616] to-[#0a0a0a] border border-white/5 shadow-2xl relative overflow-hidden print-card">
                  <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full no-print" />
                  <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-6 flex items-center gap-2 print-label">
                    <Lightbulb size={14} className="text-yellow-500/80" /> Key Insights
                  </h2>
                  <div className="space-y-5">
                    {analysis.insights?.map((insight: string, i: number) => (
                      <div key={i} className="flex gap-4 items-start group">
                        <div className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-mono text-white/40 shrink-0 mt-0.5 group-hover:bg-indigo-500/20 group-hover:text-indigo-300 group-hover:border-indigo-500/30 transition-colors print-card">
                          {i + 1}
                        </div>
                        <p className="text-sm text-white/70 leading-relaxed group-hover:text-white/90 transition-colors print-text">{insight}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Charts */}
              <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                {analysis.charts?.map((chart: any, i: number) => {
                  // Make the first chart span full width if there's an odd number of charts
                  const isFullWidth = i === 0 && analysis.charts.length % 2 !== 0;
                  
                  return (
                    <motion.div 
                      key={i} 
                      initial={{ opacity: 0, scale: 0.95 }} 
                      animate={{ opacity: 1, scale: 1 }} 
                      transition={{ delay: i * 0.1 }} 
                      className={`p-6 rounded-3xl bg-[#111111] border border-white/5 shadow-2xl flex flex-col print-card ${isFullWidth ? 'md:col-span-2' : ''}`}
                    >
                      <div className="mb-6">
                        <h3 className="text-lg font-medium text-white/90 print-text">{chart.title}</h3>
                        <p className="text-sm text-white/40 mt-1 print-label">{chart.description}</p>
                      </div>
                      <div className="flex-1 min-h-[300px] w-full">
                        <ChartRenderer data={data} config={chart} />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

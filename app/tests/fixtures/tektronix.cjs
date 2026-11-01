// Synthetic side-by-side instrument export. Contains no laboratory measurements.
module.exports=function waveform({channel='CH1',probe=10,count=24,newline='\r\n'}={}){
 const metadata=[['Record Length',count],['Sample Interval','1.000000e-06'],['Trigger Point',12],[],[],[],['Source',channel],['Vertical Units','V'],['Vertical Scale','2.000000e-01'],['Vertical Offset','0'],['Horizontal Units','s'],['Horizontal Scale','2.500000e-04'],['Pt Fmt','Y'],['Yzero','0'],['Probe Atten',probe],['Model Number','TBS1102B-EDU'],['Serial Number','SYNTHETIC'],['Firmware Version','TEST']];
 return Array.from({length:count},(_,i)=>{const [k='',v='']=metadata[i]||[],t=(i-12)*1e-6,y=.2+Math.sin(i/5);return[k,v,'','  '+t.toFixed(12).replace(/^(-?)(0\.)/,'$10$2'),'  '+y.toFixed(6),''].join(',');}).join(newline)+newline;
};

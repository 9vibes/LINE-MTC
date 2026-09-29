declare const __LINE_MTC_SERVER__:string;

// Keep the installed companion at a fixed scale while allowing normal scrolling.
if (__LINE_MTC_SERVER__) {
 const viewport=document.querySelector('meta[name="viewport"]');
 viewport?.setAttribute('content','width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
 const style=document.createElement('style');
 style.textContent='html, body { touch-action: pan-x pan-y; } input, select, textarea { font-size: 16px !important; }';
 document.head.append(style);
 // WKWebView can ignore the viewport zoom limits; also cancel native pinch gestures.
 for(const event of ['gesturestart','gesturechange','gestureend']) {
  document.addEventListener(event,e=>e.preventDefault(),{passive:false});
 }
 document.addEventListener('touchmove',e=>{if(e.touches.length>1)e.preventDefault();},{passive:false});
 document.addEventListener('dblclick',e=>e.preventDefault(),{passive:false});
}
export {};

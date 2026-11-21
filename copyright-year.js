/* iLiam copyright year: use the hosting server's HTTP Date header,
   never the visitor's computer clock. This is intentionally same-origin
   and works on static GitHub Pages without Firebase or a paid API. */
(async function updateCopyrightYear(){
  const nodes=document.querySelectorAll("[data-copyright-year]");
  if(!nodes.length)return;
  try{
    const response=await fetch("./index.html?copyright-year="+Math.random().toString(36).slice(2),{
      method:"HEAD",
      cache:"no-store"
    });
    if(!response.ok)throw new Error("Server did not respond");
    const serverDate=response.headers.get("Date");
    if(!serverDate)throw new Error("No server Date header");
    const year=new Date(serverDate).getUTCFullYear();
    if(!Number.isInteger(year)||year<2026||year>9999)throw new Error("Invalid server year");
    for(const node of nodes)node.textContent=String(year);
  }catch(error){
    // Keep the last known year from the HTML rather than trust device time.
    console.warn("Could not get server year; using footer's default year.",error);
  }
})();

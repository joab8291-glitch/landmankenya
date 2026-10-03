(() => {
  const track = (name, params={}) => {
    if (typeof window.gtag === "function") window.gtag("event", name, params);
  };
  const loadAnalytics = async () => {
    try {
      const r = await fetch("/data/site-content.json",{cache:"no-store"});
      const c = await r.json();
      const id=c?.analytics?.ga4MeasurementId;
      if(!id || id.length<5 || id.includes("XXXX")) return;
      window.dataLayer=window.dataLayer||[];
      window.gtag=function(){dataLayer.push(arguments)};
      gtag("js",new Date()); gtag("config",id);
      const s=document.createElement("script");
      s.async=true; s.src="https://www.googletagmanager.com/gtag/js?id="+encodeURIComponent(id);
      document.head.appendChild(s);
    } catch(e) { console.error("[Landman] Runtime data error:",e); }
  };
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
  const money=v=>v?new Intl.NumberFormat("en-KE",{style:"currency",currency:"KES",maximumFractionDigits:0}).format(v):"Enquire";
  const renderListings=(items)=>{
    const box=document.querySelector("#properties .cards"); if(!box || !items.length) return;
    box.innerHTML=items.map(p=>`<article class="card reveal show"><a href="/properties/${encodeURIComponent(p.slug)}"><div class="card-img" style="background-image:url('${esc(p.images?.[0]||"")}')"><span class="tag">${esc(p.type||"Property")}</span><span class="price">${money(p.price)}</span></div><div class="card-body"><h3>${esc(p.title)}</h3><div class="location">${esc(p.location||"Kenya")}</div><div class="meta"><span>${esc(p.status||"Available")}</span><span>${esc(p.bedrooms? p.bedrooms+" beds":"")}</span><span>View details</span></div></div></a></article>`).join("");
    box.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>track("select_content",{content_type:"property",content_id:a.getAttribute("href")})));
  };
  const loadListings=async()=>{
    try { const r=await fetch("/api/listings",{cache:"no-store"}); if(!r.ok){console.error("[Landman] Listings request failed:",r.status);return;} const data=await r.json(); renderListings((data.listings||[]).filter(x=>x.published!==false)); } catch(e) {}
  };
  const setupSearch=()=>{
    const btn=document.querySelector(".search-box .btn"); if(!btn)return;
    btn.addEventListener("click",async()=>{
      const type=document.querySelector("#type")?.value||"Any property";
      const location=document.querySelector("#location")?.value||"Any location";
      const purpose=document.querySelector("#purpose")?.value||"Any";
      track("search",{search_term:[type,location,purpose].join(" ")});
      try{
        const r=await fetch("/api/listings?type="+encodeURIComponent(type)+"&location="+encodeURIComponent(location)+"&purpose="+encodeURIComponent(purpose));
        if(r.ok){const d=await r.json();renderListings((d.listings||[]).filter(x=>x.published!==false));}else console.error("[Landman] Property search failed:",r.status);
      }catch(e){}
    });
  };
  const addLeadForm=()=>{
    if(document.querySelector("#lead-form"))return;
    const footer=document.querySelector("footer"); if(!footer)return;
    const sec=document.createElement("section"); sec.id="lead-form"; sec.style.cssText="padding:70px 0;background:#eef3ed";
    sec.innerHTML=`<div class="container"><div class="section-head"><div><div class="eyebrow">Property enquiry</div><h2>Tell Landman what you're looking for.</h2></div><p>Send your requirements directly to our team on WhatsApp. No account is required.</p></div><form id="landman-lead-form" style="background:#fff;border:1px solid #e7eae5;border-radius:24px;padding:24px;display:grid;grid-template-columns:1fr 1fr;gap:14px;max-width:900px"><input name="name" required placeholder="Your name" style="padding:14px;border:1px solid #ddd;border-radius:12px"><input name="phone" required placeholder="Phone number" style="padding:14px;border:1px solid #ddd;border-radius:12px"><select name="interest" style="padding:14px;border:1px solid #ddd;border-radius:12px"><option>Buying property</option><option>Renting property</option><option>Land / plots</option><option>Commercial property</option><option>Property marketing</option></select><input name="location" placeholder="Preferred location" style="padding:14px;border:1px solid #ddd;border-radius:12px"><textarea name="message" placeholder="Tell us what you need" rows="4" style="grid-column:1/-1;padding:14px;border:1px solid #ddd;border-radius:12px"></textarea><button class="btn btn-dark" style="grid-column:1/-1" type="submit">Send enquiry on WhatsApp →</button></form></div>`;
    footer.parentNode.insertBefore(sec,footer);
    document.querySelector("#landman-lead-form").addEventListener("submit",e=>{
      e.preventDefault(); const f=new FormData(e.currentTarget);
      const msg="Landman property enquiry%0A%0AName: "+encodeURIComponent(f.get("name"))+"%0APhone: "+encodeURIComponent(f.get("phone"))+"%0AInterest: "+encodeURIComponent(f.get("interest"))+"%0ALocation: "+encodeURIComponent(f.get("location")||"Not specified")+"%0AMessage: "+encodeURIComponent(f.get("message")||"");
      track("generate_lead",{form_name:"landman-property-enquiry",interest:f.get("interest")});
      window.open("https://wa.me/254798421521?text="+msg,"_blank","noopener");
    });
  };
  const bindMarketingClicks=()=>{
    document.querySelectorAll('a[href*="wa.me"]').forEach(a=>a.addEventListener("click",()=>track("whatsapp_click",{link_url:a.href})));
    document.querySelectorAll('a[href^="tel:"]').forEach(a=>a.addEventListener("click",()=>track("phone_click",{link_url:a.href})));
  };
  const applyMedia=async()=>{
    try{const c=await (await fetch("/data/site-content.json",{cache:"no-store"})).json();
      const hero=document.querySelector(".hero-img"), about=document.querySelector(".about-img"); const logoUrl=c.logo; document.querySelectorAll(".brand-logo").forEach(img=>{if(logoUrl)img.src=logoUrl}); if(logoUrl){document.querySelectorAll('link[rel="icon"]').forEach(x=>x.href=logoUrl)}
      if(hero&&c.heroImage)hero.style.backgroundImage="url('"+c.heroImage+"')";
      if(about&&c.aboutImage)about.style.backgroundImage="url('"+c.aboutImage+"')";
      const cards=document.querySelectorAll("#properties .card-img");
      const ims=[c.categoryImages?.homes,c.categoryImages?.apartments,c.categoryImages?.land];
      cards.forEach((el,i)=>{if(ims[i])el.style.backgroundImage="url('"+ims[i]+"')"});
    }catch(e){}
  };
  document.addEventListener("DOMContentLoaded",()=>{loadAnalytics();loadListings();setupSearch();addLeadForm();bindMarketingClicks();applyMedia();});
})();
const REPO=process.env.GITHUB_REPO||"joab8291-glitch/landmankenya";
const BRANCH=process.env.GITHUB_BRANCH||"main";

async function gh(path){
  const headers={"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"};
  if(process.env.GITHUB_TOKEN) headers.Authorization="Bearer "+process.env.GITHUB_TOKEN;
  const r=await fetch("https://api.github.com/repos/"+REPO+"/contents/"+path+"?ref="+encodeURIComponent(BRANCH),{headers});
  if(!r.ok) throw new Error("GitHub listings source unavailable: "+r.status);
  return r.json();
}
async function getListings(){
  const f=await gh("data/listings.json");
  return JSON.parse(Buffer.from(f.content,"base64").toString("utf8"));
}
module.exports=async(req,res)=>{
  res.setHeader("Cache-Control","s-maxage=30, stale-while-revalidate=300");
  try{
    const d=await getListings();
    let a=Array.isArray(d.listings)?d.listings:[];
    const q=req.query||{};
    const type=String(q.type||"").trim();
    const location=String(q.location||"").trim();
    const purpose=String(q.purpose||"").trim();
    if(type && type!=="Any property"){
      a=a.filter(x=>{
        const t=String(x.type||"").toLowerCase();
        const wanted=type.toLowerCase();
        return t===wanted || (wanted==="homes" && /house|home/.test(t));
      });
    }
    if(location && location!=="Any location") a=a.filter(x=>String(x.location||"").toLowerCase().includes(location.toLowerCase()));
    if(purpose && purpose!=="Any"){
      a=a.filter(x=>{
        const p=String(x.purpose||"").toLowerCase();
        const wanted=purpose.toLowerCase();
        return p.includes(wanted) || (wanted==="buy" && /sale|sell/.test(p)) || /both/.test(p);
      });
    }
    res.status(200).json({listings:a});
  }catch(e){
    console.error("[listings]",e);
    res.status(500).json({error:"Listings are temporarily unavailable"});
  }
};

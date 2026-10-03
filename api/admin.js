const crypto = require("crypto");

const REPO = process.env.GITHUB_REPO || "joab8291-glitch/landmankenya";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const COOKIE = "landman_admin";
const MAX_AGE = 60 * 60 * 8;

function json(res, status, body) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(status).json(body);
}
function token(exp) {
  const data = String(exp);
  const sig = crypto.createHmac("sha256", process.env.ADMIN_PASSWORD || "").update(data).digest("hex");
  return data + "." + sig;
}
function validSession(req) {
  const header = req.headers.cookie || "";
  const m = header.match(new RegExp("(^|;\\s*)" + COOKIE + "=([^;]+)"));
  if (!m || !process.env.ADMIN_PASSWORD) return false;
  const [exp, sig] = m[2].split(".");
  if (!exp || !sig || Number(exp) < Math.floor(Date.now() / 1000)) return false;
  const expected = crypto.createHmac("sha256", process.env.ADMIN_PASSWORD).update(exp).digest("hex");
  try { return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)); } catch (_) { return false; }
}
function cookie(value, maxAge = MAX_AGE) {
  return COOKIE + "=" + value + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" + maxAge;
}
function body(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === "object") return resolve(req.body);
    let raw = "";
    req.on("data", c => { raw += c; if (raw.length > 1000000) reject(new Error("Request too large")); });
    req.on("end", () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}
function headers() {
  const h = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  if (process.env.GITHUB_TOKEN) h.Authorization = "Bearer " + process.env.GITHUB_TOKEN;
  return h;
}
async function gh(path, options = {}) {
  const r = await fetch("https://api.github.com/repos/" + REPO + "/contents/" + path + "?ref=" + encodeURIComponent(BRANCH), {
    ...options, headers: { ...headers(), ...(options.headers || {}) }
  });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch (_) { data = { message: text }; }
  if (!r.ok) throw new Error(data.message || ("GitHub API " + r.status));
  return data;
}
async function readListings() {
  const f = await gh("data/listings.json");
  return { sha: f.sha, data: JSON.parse(Buffer.from(f.content, "base64").toString("utf8")) };
}
async function writeListings(data, sha, message) {
  if (!process.env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is not configured");
  const r = await fetch("https://api.github.com/repos/" + REPO + "/contents/data/listings.json", {
    method: "PUT",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: Buffer.from(JSON.stringify(data, null, 2) + "\n").toString("base64"),
      sha,
      branch: BRANCH
    })
  });
  const out = await r.json();
  if (!r.ok) throw new Error(out.message || ("GitHub write failed: " + r.status));
  return out;
}

function seoFor(x) {
  const location=String(x.location||"Kenya").trim(), type=String(x.type||"Property").trim(), purpose=String(x.purpose||"Sale").trim().toLowerCase(), title=String(x.title||"").trim();
  const price=x.price ? " KSh "+Number(x.price).toLocaleString("en-KE") : "";
  const seoTitle=([title,type,purpose,location].filter(Boolean).join(" | ")+" | Landman Properties").replace(/\s+/g," ").slice(0,60);
  const features=Array.isArray(x.features)&&x.features.length ? " "+x.features.slice(0,5).join(", ")+".":"";
  const seoDescription=("Explore "+title+" in "+location+", Kenya. "+type+" for "+purpose+"."+price+features+" Contact Landman Properties for viewing and property information.").replace(/\s+/g," ").slice(0,160);
  return {seoTitle,seoDescription};
}
function cleanListing(x) {
  const title = String(x.title || "").trim();
  if (!title) throw new Error("Property title is required");
  const slug = String(x.slug || title).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
  if (!slug) throw new Error("A valid property slug is required");
  const price = x.price === "" || x.price == null ? null : Number(x.price);
  return {
    id: String(x.id || crypto.randomUUID()),
    slug,
    title,
    type: String(x.type || "Property").trim(),
    purpose: String(x.purpose || "Sale").trim(),
    location: String(x.location || "Kenya").trim(),
    price: Number.isFinite(price) ? price : null,
    status: String(x.status || "Available").trim(),
    bedrooms: x.bedrooms === "" || x.bedrooms == null ? null : Number(x.bedrooms),
    description: String(x.description || "").trim(),
    features: Array.isArray(x.features) ? x.features.map(v => String(v).trim()).filter(Boolean).slice(0, 30) : [],
    images: Array.isArray(x.images) ? x.images.map(v => String(v).trim()).filter(Boolean).slice(0, 20) : [],
    published: x.published !== false,
    seoTitle: seoFor(x).seoTitle,
    seoDescription: seoFor(x).seoDescription,
    updatedAt: new Date().toISOString()
  };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const action = String(req.query.action || "").toLowerCase();

    if (action === "login") {
      if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
      const b = await body(req);
      if (!process.env.ADMIN_PASSWORD || !b.password || b.password !== process.env.ADMIN_PASSWORD) {
        return json(res, 401, { error: "Invalid password" });
      }
      res.setHeader("Set-Cookie", cookie(token(Math.floor(Date.now() / 1000) + MAX_AGE)));
      return json(res, 200, { ok: true });
    }

    if (action === "logout") {
      res.setHeader("Set-Cookie", cookie("", 0));
      return json(res, 200, { ok: true });
    }

    if (!validSession(req)) return json(res, 401, { error: "Unauthorized" });

    if (action === "upload") {
      if (req.method !== "POST") return json(res,405,{error:"Method not allowed"});
      const b=await body(req);
      const m=String(b.dataUrl||"").match(/^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/i);
      if(!m) return json(res,400,{error:"Only PNG and JPG/JPEG images are allowed"});
      const bytes=Buffer.from(m[2],"base64");
      if(bytes.length>6*1024*1024) return json(res,413,{error:"Image is too large. Maximum size is 6 MB."});
      const ext=m[1].toLowerCase()==="image/png"?"png":"jpg";
      const safe=String(b.filename||"property-image").replace(/[^a-zA-Z0-9_-]/g,"-").slice(0,60)||"property-image";
      const path="public/images/properties/"+Date.now()+"-"+safe+"."+ext;
      const r=await fetch("https://api.github.com/repos/"+REPO+"/contents/"+path,{method:"PUT",headers:{...headers(),"Content-Type":"application/json"},body:JSON.stringify({message:"Upload property image via admin",content:bytes.toString("base64"),branch:BRANCH})});
      const out=await r.json(); if(!r.ok) throw new Error(out.message||"Image upload failed");
      return json(res,200,{ok:true,path:"/"+path.replace(/^public\//,"")});
    }


    if (req.method === "GET") {
      const { data } = await readListings();
      return json(res, 200, { listings: Array.isArray(data.listings) ? data.listings : [] });
    }

    const b = await body(req);
    const { data, sha } = await readListings();
    const listings = Array.isArray(data.listings) ? data.listings : [];

    if (action === "save") {
      const item = cleanListing(b.listing || {});
      const index = listings.findIndex(x => String(x.id || "") === item.id || String(x.slug || "") === item.slug);
      const duplicate = listings.findIndex((x, i) => String(x.slug || "") === item.slug && i !== index);
      if (duplicate >= 0) return json(res, 409, { error: "Another property already uses this slug" });
      if (index >= 0) listings[index] = item; else listings.unshift(item);
      await writeListings({ listings }, sha, (index >= 0 ? "Update" : "Add") + " property listing via admin");
      return json(res, 200, { ok: true, listing: item });
    }

    if (action === "delete") {
      const id = String(b.id || "");
      const index = listings.findIndex(x => String(x.id || "") === id);
      if (index < 0) return json(res, 404, { error: "Property not found" });
      const removed = listings.splice(index, 1)[0];
      await writeListings({ listings }, sha, "Delete property listing via admin");
      return json(res, 200, { ok: true, removed });
    }

    return json(res, 400, { error: "Unknown action" });
  } catch (e) {
    console.error("[admin]", e);
    return json(res, 500, { error: e.message || "Admin operation failed" });
  }
};

// Read-only Firebase Rules deployment readiness check.
// Never print service-account credentials or the rules source.
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {initializeApp,cert,getApp} from "firebase-admin/app";

const key=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "null");
if(!key?.project_id || !key.private_key)throw Error("FIREBASE_SERVICE_ACCOUNT missing or invalid");
initializeApp({credential:cert(key),projectId:key.project_id});
const token=(await getApp().options.credential.getAccessToken()).access_token;
const headers={Authorization:"Bearer "+token};
const project=key.project_id;
const hash=s=>createHash("sha256").update(s).digest("hex").slice(0,16);
async function call(url,options={}){
 const response=await fetch(url,{...options,headers:{...headers,...options.headers}});
 const body=await response.json().catch(()=>({}));
 return {ok:response.ok,status:response.status,body};
}
const required=["firebaserules.releases.get","firebaserules.rulesets.get","firebaserules.rulesets.create","firebaserules.releases.update","firebaserules.releases.create"];
const permissions=await call("https://cloudresourcemanager.googleapis.com/v1/projects/"+encodeURIComponent(project)+":testIamPermissions",{
 method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({permissions:required})
});
if(permissions.ok){
 const granted=permissions.body.permissions||[];
 for(const permission of required)console.log("PERMISSION "+permission+": "+(granted.includes(permission)?"YES":"NO"));
}else console.log("PERMISSION_CHECK: HTTP "+permissions.status+" (inconclusive)");
const release=await call("https://firebaserules.googleapis.com/v1/projects/"+encodeURIComponent(project)+"/releases/cloud.firestore");
if(!release.ok){console.log("LIVE_RULES_READ: HTTP "+release.status+" (comparison unavailable)");process.exit(0);}
const rulesetName=release.body.rulesetName;
if(!rulesetName){console.log("LIVE_RULES_READ: no active ruleset reported");process.exit(0);}
const active=await call("https://firebaserules.googleapis.com/v1/"+rulesetName);
if(!active.ok){console.log("LIVE_RULES_READ: HTTP "+active.status+" (comparison unavailable)");process.exit(0);}
const files=active.body.source?.files||[];
const live=files.find(f=>f.name==="firestore.rules")?.content||(files.length===1?files[0].content:null);
if(typeof live!=="string"){console.log("LIVE_RULES_READ: source unavailable");process.exit(0);}
const local=readFileSync("firestore.rules","utf8");
console.log("LIVE_RULES_READ: YES");
console.log("RULES_EXACT_MATCH: "+(live===local?"YES":"NO"));
console.log("GITHUB_RULES_SHA256_PREFIX: "+hash(local));
console.log("LIVE_RULES_SHA256_PREFIX: "+hash(live));

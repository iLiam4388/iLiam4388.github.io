// Read-only Firebase Rules deployment readiness check.
// Recheck IAM permissions after the Google Cloud policy update.
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

// Report the nature of the mismatch without publishing live rule contents.
if(live!==local){
 const oldBoardDelete=local.replace(
  "      // Only the owner can delete a board after removing its drawings.\n      allow delete: if signedIn() && resource.data.ownerId == request.auth.uid;",
  "      allow delete: if false;"
 );
 const normalized=value=>value.replace(/\r\n/g,"\n").trimEnd();
 console.log("ONLY_RECENT_BOARD_DELETE_CHANGE: "+(normalized(oldBoardDelete)===normalized(live)?"YES":"NO"));
 const a=local.split(/\r?\n/),b=live.split(/\r?\n/);
 const first=a.findIndex((line,i)=>line!==b[i]);
 console.log("GITHUB_RULES_LINE_COUNT: "+a.length);
 console.log("LIVE_RULES_LINE_COUNT: "+b.length);
 console.log("FIRST_DIFFERING_LINE: "+(first>=0?first+1:Math.min(a.length,b.length)+1));
}

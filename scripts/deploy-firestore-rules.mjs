// Publish ONLY the default Cloud Firestore rules release using Firebase Rules API.
// Requires the existing FIREBASE_SERVICE_ACCOUNT in GitHub Actions.
// The Rules API compiles/validates a ruleset before it can be activated.
import {readFileSync} from "node:fs";
import {initializeApp,cert,getApp} from "firebase-admin/app";

const account=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT||"null");
if(!account?.private_key||account.project_id!=="iliam-4d0c9"){
 throw Error("Missing or mismatched FIREBASE_SERVICE_ACCOUNT");
}
initializeApp({credential:cert(account),projectId:account.project_id});
const token=(await getApp().options.credential.getAccessToken()).access_token;
const base="https://firebaserules.googleapis.com/v1/";
const project="projects/"+account.project_id;
const releaseName=project+"/releases/cloud.firestore";
const source=readFileSync("firestore.rules","utf8");
if(!source.startsWith("rules_version = '2';")||!source.includes("service cloud.firestore")){
 throw Error("Unexpected Firestore rules source; refusing deployment");
}
const normalize=s=>s.replace(/\r\n/g,"\n").trimEnd();
async function api(path,method="GET",payload){
 const response=await fetch(base+path,{
  method,
  headers:{Authorization:"Bearer "+token,...(payload?{"Content-Type":"application/json"}:{})},
  ...(payload?{body:JSON.stringify(payload)}:{})
 });
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw Error("Firebase Rules API "+method+" "+path.split("/").slice(-1)[0]+
   " returned HTTP "+response.status+" "+JSON.stringify(body.error?.message||"").slice(0,700));
 return body;
}
const current=await api(releaseName);
const existing=await api(current.rulesetName);
const files=existing.source?.files||[];
const live=files.find(f=>f.name==="firestore.rules")?.content??(files.length===1?files[0].content:null);
if(typeof live!=="string")throw Error("Cannot read current rules; refusing deployment");
if(normalize(live)===normalize(source)){
 console.log("No deployment needed: live Firestore rules already match GitHub.");
 process.exit(0);
}
console.log("Creating and validating new Firestore ruleset...");
const created=await api(project+"/rulesets","POST",{source:{files:[{name:"firestore.rules",content:source}]}});
if(!created.name)throw Error("Firebase did not return a ruleset name");
console.log("Validation passed. Activating ruleset for cloud.firestore...");
await api(releaseName,"PATCH",{release:{name:releaseName,rulesetName:created.name},updateMask:"rulesetName"});
const deployed=await api(releaseName);
if(deployed.rulesetName!==created.name)throw Error("Active release does not point to the new ruleset");
console.log("Firebase Firestore rules released successfully.");

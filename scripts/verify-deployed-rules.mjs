// Verify that the live default Cloud Firestore release matches GitHub.
// This script reads rules only. It never publishes or prints rule contents.
import {readFileSync} from "node:fs";
import {initializeApp,cert,getApp} from "firebase-admin/app";

const serviceAccount=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT||"null");
if(!serviceAccount?.private_key||serviceAccount.project_id!=="iliam-4d0c9"){
 throw Error("Missing or mismatched FIREBASE_SERVICE_ACCOUNT.");
}
initializeApp({credential:cert(serviceAccount),projectId:serviceAccount.project_id});
const token=(await getApp().options.credential.getAccessToken()).access_token;
const headers={Authorization:"Bearer "+token};
async function getJson(url){
 const response=await fetch(url,{headers});
 if(!response.ok)throw Error("Firebase Rules API returned HTTP "+response.status);
 return response.json();
}
const project=encodeURIComponent(serviceAccount.project_id);
const release=await getJson("https://firebaserules.googleapis.com/v1/projects/"+project+"/releases/cloud.firestore");
if(!release.rulesetName)throw Error("Active Cloud Firestore release not found");
const ruleset=await getJson("https://firebaserules.googleapis.com/v1/"+release.rulesetName);
const files=ruleset.source?.files||[];
const live=files.find(f=>f.name==="firestore.rules")?.content
  ??(files.length===1?files[0].content:null);
if(typeof live!=="string")throw Error("Active rules source is unavailable");
const expected=readFileSync("firestore.rules","utf8");
const normalized=s=>s.replace(/\r\n/g,"\n").trimEnd();
if(normalized(live)!==normalized(expected)){
 console.error("FAIL: Live Firestore rules differ from GitHub. Deployment not verified.");
 process.exitCode=1;
}else{
 console.log("PASS: Live Cloud Firestore rules match GitHub (ignoring trailing whitespace).");
}

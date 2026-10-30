// Local enrollment prototype. Production Registry binding remains disabled.
const random=bytes=>btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(bytes)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
export async function sessionDigest(secret){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret)))).map(v=>v.toString(16).padStart(2,'0')).join('')}
export async function createEnrollment(now){
 const browserSecret=random(32),publicChallenge=random(16);
 return {browserSecret,publicChallenge,record:{publicChallenge,createdAt:now,digest:await sessionDigest(browserSecret),expiresAt:now+15*60000,memberKey:null,consumed:false}};
}
export function approveEnrollment(record,memberKey,now){
 if(!/^member-[0-9]{2}$/.test(memberKey))throw Error('verified member key required');
 if(now>=record.expiresAt||record.consumed)throw Error('expired or consumed challenge');
 if(record.memberKey&&record.memberKey!==memberKey)throw Error('approval conflict');
 return {...record,memberKey};
}
export async function claimEnrollment(record,secret,now){
 if(now>=record.expiresAt||record.consumed)throw Error('expired or consumed challenge');
 if(!record.memberKey)throw Error('approval required');
 if(typeof secret!=='string'||secret.length!==43||await sessionDigest(secret)!==record.digest)throw Error('wrong browser');
 return {memberKey:record.memberKey,digest:record.digest,expiresAt:now+7*86400000};
}

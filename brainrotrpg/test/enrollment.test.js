import {test} from 'node:test';import assert from 'node:assert/strict';import {createEnrollment, approveEnrollment, claimEnrollment, sessionDigest} from '../src/enrollment.js';
test('public challenge cannot claim browser session and approval remains separate',async()=>{
 const e=await createEnrollment(1000);assert.equal(e.browserSecret.length,43);assert.equal(e.publicChallenge.length,22);assert.notEqual(e.browserSecret,e.publicChallenge);
 assert.equal(e.record.secret,undefined);assert.equal(e.record.digest,await sessionDigest(e.browserSecret));
 assert.throws(()=>approveEnrollment(e.record,'not-verified',1001),/member/);
 const approved=approveEnrollment(e.record,'member-01',1001);
 await assert.rejects(claimEnrollment(approved,e.publicChallenge,1002),/browser/);
 const session=await claimEnrollment(approved,e.browserSecret,1002);assert.equal(session.memberKey,'member-01');assert.equal(session.expiresAt,1002+7*86400000);
 await assert.rejects(claimEnrollment(e.record,e.browserSecret,1002),/approval/);
 await assert.rejects(claimEnrollment(approved,e.browserSecret,1000+16*60000),/expired/);
});

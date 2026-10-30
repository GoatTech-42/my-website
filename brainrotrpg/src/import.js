import {validateSnapshot} from './state.js';
export function importBaseline(input){
 if(input.snapshot?.kind!=='migration-baseline'||input.snapshot.audience!=='group-restricted'||input.snapshot.sequence!==0)throw Error('unsupported baseline');
 if(input.battle_session_log?.entries?.length!==0)throw Error('nonempty log needs explicit adapter');
 const characters=input.characters.map(c=>{
  if(c.assigned_bonuses!=='none assigned yet')throw Error('assigned bonuses need explicit adapter');
  return {id:c.key,name:c.name,classStyle:[c.class,c.fighting_style].filter(Boolean).join(' / '),race:c.race,hp:c.hp.current,maxHp:c.hp.max,status:c.status_effects.join('; '),bonuses:[],gear:[],inventory:c.gear_inventory,kills:c.record.kills,wins:c.record.wins,location:c.location,bio:c.bio??'',pendingTraits:c.pending_trait_intent?[c.pending_trait_intent]:[]};
 });
 // The source combines gear/inventory. Keep it combined; do not invent equipped slots.
 return validateSnapshot({characters,lore:[],rolls:[],world:structuredClone(input.world)});
}

/* Run actual external comparisons; never substitute a stored pass flag. */
for(const name of ['math','spice','opamp','bench','analyses','semiconductors','radiation']){const result=require('./benchmark-'+name+'.cjs').run();if(!result.pass)throw Error('Numerical reference failed: '+name);}

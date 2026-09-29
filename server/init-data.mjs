import {mkdirSync,chownSync,chmodSync} from 'node:fs';
mkdirSync('/data',{recursive:true});chownSync('/data',1000,1000);chmodSync('/data',0o700);

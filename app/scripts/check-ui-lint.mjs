import {ESLint} from 'eslint'
import {execFileSync} from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
const baseline='10398f3b9b03bb019ec4c1b0558d6ef9d5154150'
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:10*1024*1024})
const eslint=new ESLint()
const files=git('-C','..','diff','--name-only','--diff-filter=M',baseline,'--','app/src').trim().split('\n').filter(file=>/\.tsx?$/.test(file))
if(!files.length)throw new Error('No changed source files found; lint comparison must not pass vacuously.')
let before=0,after=0;const added=[]
const signatures=result=>result.messages.map(message=>`${message.severity}:${message.ruleId}:${message.message.split('\n\n/')[0]}`)
for(const file of files){
  const filePath=path.resolve('..',file)
  const [old]=await eslint.lintText(git('show',`${baseline}:${file}`),{filePath})
  const [current]=await eslint.lintText(fs.readFileSync(filePath,'utf8'),{filePath})
  const remaining=signatures(old);before+=old.errorCount;after+=current.errorCount
  for(const message of signatures(current)){const index=remaining.indexOf(message);if(index>=0)remaining.splice(index,1);else added.push({file,message})}
}
for(const file of ['src/components/ui/AgendaEditor.tsx','src/components/ui/GrowingTextarea.tsx','src/components/ui/SessionProgress.tsx','src/utils/agenda.ts','tests/ui-preview.tsx','tests/ui-regression.test.mjs','scripts/check-ui-lint.mjs']){
  const [result]=await eslint.lintFiles(file)
  after+=result.errorCount
  for(const message of signatures(result))added.push({file,message})
}
console.log(JSON.stringify({trackedFiles:files.length,baselineErrors:before,currentErrors:after,newFindings:added},null,2))
if(added.some(item=>item.message.startsWith('2:')))process.exitCode=1

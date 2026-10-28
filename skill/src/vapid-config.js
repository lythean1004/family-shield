import webpush from 'web-push'
export function mergeVapidConfig(original,generate=webpush.generateVAPIDKeys.bind(webpush)) {
  const value=name=>original.match(new RegExp(`^${name}=(.*)$`,'m'))?.[1]?.trim()
  const publicKey=value('VAPID_PUBLIC_KEY'),privateKey=value('VAPID_PRIVATE_KEY')
  if(Boolean(publicKey)!==Boolean(privateKey))throw new Error('Incomplete VAPID pair')
  const keys=publicKey?{publicKey,privateKey}:generate()
  const subject=value('VAPID_SUBJECT')||'https://familyshield.kr'
  const clean=original.split('\n').filter(line=>!/^VAPID_(PUBLIC_KEY|PRIVATE_KEY|SUBJECT)=/.test(line)).join('\n')
  return `${clean.replace(/\n*$/,'')}\nVAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\nVAPID_SUBJECT=${subject}\n`
}

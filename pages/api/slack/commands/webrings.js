import { unverifiedRequest, getUserRecord, accountsTable, sendCommandResponse, t } from "../../../../lib/api-utils"

export default async (req, res) => {
  if (unverifiedRequest(req)) return res.status(400).send('Unverified Slack request!')
  else res.status(200).end()

  const { user_id, response_url, text } = req.body
  console.log('webring text', text)
  const webringUser = text.split(' ')[1].split('@')[1].split('|')[0]
  console.log('webring user', webringUser)
  if (!webringUser) {
    return sendCommandResponse(response_url, t('messages.webrings.noargs'))
  }

  let userRecord
  try {
    userRecord = await getUserRecord(user_id)
  } catch {
    return sendCommandResponse(response_url, t('messages.webrings.invaliduser'))
  }
  const webringUserRecord = await getUserRecord(webringUser)
  let currentWebrings = userRecord.fields['Webring']
  console.log('current webrings', currentWebrings)
  if (!currentWebrings) {
    currentWebrings = [webringUserRecord.id]
  } else {
    currentWebrings = currentWebrings.push(webringUserRecord.id)
    console.log('new webrings', currentWebrings)
  }
  await Promise.all([
    accountsTable.update(userRecord.id, { 'Webring': currentWebrings }),
    sendCommandResponse(response_url, t('messages.webrings.set'), { webringUser })
  ])
}
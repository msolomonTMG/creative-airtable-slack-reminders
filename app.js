const utils = require('./utils')
const request = require('request')
const Airtable = require('airtable')
const base = new Airtable({apiKey: process.env.AIRTABLE_API_KEY}).base(process.env.AIRTABLE_BASE_ID)

let slackAttachments = []

base(process.env.AIRTABLE_TABLE_NAME).select({
    view: process.env.AIRTABLE_VIEW_NAME,
    filterByFormula: process.env.AIRTABLE_FILTER_FORMULA,
    sort: [{field: process.env.AIRTABLE_SORT_FIELD_NAME, direction: "desc"}]
}).eachPage(function page(tasks, fetchNextPage) {
    // This function (`page`) will get called for each page of records.

    tasks.forEach(function(task, index) {
      
      let taskName = task.get('Name')
    
      let color = utils.setColor(task)
      let project = utils.getProjects(task)
      let people = utils.getPeople(task)
      
      Promise.all([color, project, people]).then(values => {
        let color = values[0],
            project = values[1],
            people = values[2];
        
        let slackAttachment = {
          color: color,
          fields: [
            {
              title: 'Task',
              value: task.get('Name'),
              short: true
            },
            {
              title: 'Project',
              value: project,
              short: true
            },
            {
              title: 'Due Date',
              value: task.get('Due Date'),
              short: true
            },
            {
              title: 'People',
              value: people,
              short: true
            }
          ]
        }
        
        slackAttachments.push(slackAttachment)
        
        // if this is the last task, send to slack
        if (index + 1 == tasks.length) {
          slackAttachments.sort(compare)
          console.log(slackAttachments)
          let postData = {
            text: `:wave: Here are some due dates to keep in mind!`,
            attachments: slackAttachments
          }
          let options = {
            method: 'post',
            body: postData,
            json: true,
            url: process.env.SLACK_URL
          }
          
          request(options, function(err, response, body) {
            if (err) { console.log(err); return; }
            console.log(body)
          })
        }
      })      
    })

    // To fetch the next page of records, call `fetchNextPage`.
    // If there are more records, `page` will get called again.
    // If there are no more records, `done` will get called.
    // each page is 100 records... we should never call this
    fetchNextPage();

}, function done(err) {
    if (err) { console.error(err); return; }
});


function compare(a, b) {
  if (a.fields[2].value < b.fields[2].value)
    return -1;
  if (a.fields[2].value > b.fields[2].value)
    return 1;
  return 0;
}

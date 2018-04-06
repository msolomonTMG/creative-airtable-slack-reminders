const moment = require('moment')
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
      let taskDueDate = moment(new Date(task.get('Due Date')).setHours(0,0,0,0)).add(1, 'day') // no idea why we need to add a day
      let today = moment(new Date().setHours(0,0,0,0))
      let color = ''
      
      // set color to red if past due
      // set color to orange if today
      // leave color as default if in the future
      if (taskDueDate < today) {
        color = 'danger'
      } else if (taskDueDate.isSame(today)) {
        color = 'warning'
      } else {
        color = 'success'
      }
      
      let slackAttachment = {
        color: color,
        fields: [
          {
            title: 'Due Date',
            value: task.get('Due Date'),
            short: true
          },
          {
            title: 'Task',
            value: task.get('Name'),
            short: true
          }
        ]
      }
            
      if (task.get('Project').length > 0) {
        base('Projects').find(task.get('Project'), function(err, project) {
          if (err) { console.log(err); return; }
          slackAttachment.fields.push({
            title: 'Project',
            value: project.get('Name'),
            short: true
          })
          
          if (task.get('People').length > 0) {
            base('People').find(task.get('People'), function(err, people) {
              if (err) { console.log(err); return; }
              slackAttachment.fields.push({
                title: 'People',
                value: people.get('Name'),
                short: true
              })
              slackAttachments.push(slackAttachment)
            })
          } else {
            slackAttachments.push(slackAttachment)
          }
        })
      } else {
        if (task.get('People').length > 0) {
          base('People').find(task.get('People'), function(err, people) {
            if (err) { console.log(err); return; }
            slackAttachment.fields.push({
              title: 'People',
              value: people.get('Name'),
              short: true
            })
            slackAttachments.push(slackAttachment)
          })
        } else {
          slackAttachments.push(slackAttachment)
        }
      }
      
      // wait 3s because project.get('Name') takes a while
      // then send tasks to slack
      setTimeout(function() {
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
      }, 3000)

      
    });

    // To fetch the next page of records, call `fetchNextPage`.
    // If there are more records, `page` will get called again.
    // If there are no more records, `done` will get called.
    // each page is 100 records... we should never call this
    fetchNextPage();

}, function done(err) {
    if (err) { console.error(err); return; }
});


function compare(a, b) {
  if (a.fields[0].value < b.fields[0].value)
    return -1;
  if (a.fields[0].value > b.fields[0].value)
    return 1;
  return 0;
}

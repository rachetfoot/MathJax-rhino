var jackrabbit = require('jackrabbit');
var queue = jackrabbit('amqp://localhost');

var mjAPI = require("./lib/mj-single.js");

var argv = require("yargs")
    .demand(0).strict()
    .usage("Usage: server [options]",{
      inline: {
        boolean: true,
        describe: "process as in-line TeX"
      },
      linebreaks: {
        boolean: true,
        describe: "perform automatic line-breaking"
      },
      dpi: {
        default: 0,
        describe: "dpi for image (0 = calculate automatically)"
      },
      font: {
        default: "TeX",
        describe: "web font to use"
      },
      ex: {
        default: 8,
        describe: "ex-size in pixels"
      },
      width: {
        default: 100,
        describe: "width of container in ex"
      },
      extensions: {
        default: "color.js",
        describe: "extra MathJax extensions e.g. 'Safe,TeX/noUndefined'"
      }
    })
    .argv;

if (argv.font === "STIX") argv.font = "STIX-Web";
mjAPI.config({MathJax: {SVG: {font: argv.font, blacker: 0}}, extensions: argv.extensions});
mjAPI.start();

if (argv.dpi === 0) {argv.dpi = argv.ex * 16} // pixels properly sized

function typeset(math, callback) {
  mjAPI.typeset({
    math: math,
    format: ("NoDelims"),
    svg: true, dpi: argv.dpi,
    ex: argv.ex, width: argv.width,
    linebreaks: argv.linebreaks
  }, callback);
}

typeset('$x$', function() {});

queue.on('connected', function() {
  queue.create('jobs.generatesvg', { prefetch: 0, messageTtl: 1000}, onReady);

  function onReady() {
    queue.handle('jobs.generatesvg', onJob);
  }

  function onJob(job, ack) {
    console.log('Received job: ' + job.body);

    function onTypeset(data) {
      if (!data.errors) {
        ack({svg: data.svg})
      } else {
        ack({error: data.errors.join(', ')});
      }
    }

    typeset(job.body, onTypeset);
  }
});
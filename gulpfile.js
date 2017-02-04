"use strict";

const gulp = require('gulp');

const browserify = require('browserify');
const babelify = require('babelify');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const uglify = require('gulp-uglify');
const sourcemaps = require('gulp-sourcemaps');
const eslint = require("gulp-eslint");
const jasmine = require("gulp-jasmine");
const runSequence = require('run-sequence').use(gulp);
const jsdoc2md = require("jsdoc-to-markdown");
const toc = require('markdown-toc');
const Promise = require("bluebird");
const fs = Promise.promisifyAll(require("fs"));
const jasmineConfig = require('./spec/support/jasmine.json');

const BROWSERIFY_STANDALONE_NAME = "XLSXPopulate";
const BABEL_PRESETS = ["es2015"];
const PATHS = {
    lib: "./lib/**/*.js",
    spec: "./spec/**/*.js",
    examples: "./examples/**/*.js",
    browserify: {
        source: "./lib/Workbook.js",
        base: "./browser",
        bundle: "xlsx-populate.js",
        sourceMap: "./"
    },
    readme: {
        template: "./docs/template.md",
        build: "./README.md"
    },
    blank: {
        workbook: "./blank/blank.xlsx",
        template: "./blank/template.js",
        build: "./lib/blank.js"
    }
};

PATHS.lint = [PATHS.lib];
PATHS.testSources = [PATHS.lib, PATHS.spec];

gulp.task('build', () => {
    return browserify({
        entries: PATHS.browserify.source,
        debug: true,
        standalone: BROWSERIFY_STANDALONE_NAME
    })
        .transform("babelify", { presets: BABEL_PRESETS })
        .bundle()
        .pipe(source(PATHS.browserify.bundle))
        .pipe(buffer())
        .pipe(sourcemaps.init({ loadMaps: true }))
        .pipe(uglify())
        .pipe(sourcemaps.write(PATHS.browserify.sourceMap))
        .pipe(gulp.dest(PATHS.browserify.base));
});

gulp.task("lint", () => {
    return gulp
        .src(PATHS.lint)
        .pipe(eslint())
        .pipe(eslint.format());
});

gulp.task("unit", () => {
    return gulp
        .src(PATHS.spec)
        .pipe(jasmine({
            config: jasmineConfig,
            includeStackTrace: false,
            errorOnFail: false
        }));
});

gulp.task("blank", () => {
    return Promise
        .all([
            fs.readFileAsync(PATHS.blank.workbook, "base64"),
            fs.readFileAsync(PATHS.blank.template, "utf8")
        ])
        .spread((data, template) => {
            const output = template.replace("{{DATA}}", data);
            return fs.writeFileAsync(PATHS.blank.build, output);
        });
});

gulp.task("docs", () => {
    return fs.readFileAsync(PATHS.readme.template, "utf8")
        .then(text => {
            const tocText = toc(text).content;
            text = text.replace("<!-- toc -->", tocText);
            return jsdoc2md.render({ files: PATHS.lib })
                .then(apiText => {
                    apiText = apiText.replace(/^#/mg, "##");
                    text = text.replace("<!-- api -->", apiText);
                    return fs.writeFileAsync(PATHS.readme.build, text);
                });
        });
});

gulp.task("test", cb => {
    // Use run sequence to make sure lint and unit run in series. They both output to the
    // console so parallel execution would lead to some funny output.
    runSequence("unit", cb);//"lint"
});

gulp.task('watch', () => {
    gulp.watch([PATHS.blank.template, PATHS.blank.workbook], ['blank']);
    // gulp.watch(PATHS.lib, ['build']);
    gulp.watch(PATHS.testSources, ["test"]);
    gulp.watch([PATHS.lib, PATHS.readme.template], ["docs"]);
});

gulp.task("default", cb => {
    runSequence("blank", ["build", "test", "docs"], "watch", cb);
});

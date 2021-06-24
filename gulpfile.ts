import { dest, parallel, src } from "gulp";
import * as aprep from "gulp-append-prepend";
import * as css_prefix from "gulp-autoprefixer";
import * as rename from "gulp-rename";
import * as ts from "gulp-typescript";
import * as ug from "gulp-uglify";
import GulpClient = require("gulp");

const config = {
    globs: {
        html: {
            src: "src/html/**/*",
            dest: "dist",
        },
        css: {
            src: "src/css/**/*",
            dest: "dist/css",
        },
        front: {
            src: ["src/js/**/*", "!src/js/**/*.json"],
            dest: "dist/js",
        },
    },
    tsconfig: {
        front: "./src/js/",
        main: ".",
        vars: "./src/vars/",
    },
};

const frontProject = ts.createProject(`${config.tsconfig.front}tsconfig.json`);

const buildFrontendJs: GulpClient.TaskFunction = () => {
    return src(config.globs.front.src)
        .pipe(frontProject())
        .pipe(
            ug({
                output: { webkit: true },
                compress: true,
                mangle: { keep_fnames: true },
            })
        )
        .pipe(
            rename({
                extname: ".html", //apps script treats .js files as .gs
            })
        )
        .pipe(aprep.prependText(`<script type="text/javascript">`))
        .pipe(aprep.appendText(`</script>`))
        .pipe(dest(config.globs.front.dest));
};

const buildFrontendCSS: GulpClient.TaskFunction = () => {
    return src(config.globs.css.src)
        .pipe(css_prefix())
        .pipe(
            rename({
                extname: ".html",
            })
        )
        .pipe(aprep.prependText("<style>"))
        .pipe(aprep.appendText("</style>"))
        .pipe(dest(config.globs.css.dest));
};

const copyHTMLToDist: GulpClient.TaskFunction = () => {
    return src(config.globs.html.src).pipe(dest(config.globs.html.dest));
};

export default parallel(buildFrontendJs, buildFrontendCSS, copyHTMLToDist);

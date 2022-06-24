import { PythonStubGeneratorOutput } from "../types";
import path from "path";
import fs from "fs";
import { getFiles } from "@atrilabs/scripts";

export function createPythonAppTemplateManager(
  paths: { controllers: string; pythonAppTemplate: string },
  pages: { name: string; route: string }[]
) {
  const routeMainPyTemplatePath = path.resolve(
    paths.pythonAppTemplate,
    "routes",
    "main.py"
  );
  const variableMap: {
    [pageName: string]: { output: PythonStubGeneratorOutput };
  } = {};
  function addVariables(pageName: string, output: PythonStubGeneratorOutput) {
    variableMap[pageName] = { output };
  }
  function flushAtriPyFile(page: { name: string; route: string }) {
    const classTasks: {
      className: string;
      attrs: { name: string; type: string }[];
    }[] = [];
    const varClassMap: { [varName: string]: string } = {};
    function addClassTask(className: string, value: any) {
      const attrs: { name: string; type: string }[] = [];
      const attrNames = Object.keys(value);
      attrNames.forEach((attrName) => {
        switch (typeof value[attrName]) {
          case "string":
            attrs.push({ name: attrName, type: "str" });
            break;
          case "boolean":
            attrs.push({ name: attrName, type: "bool" });
            break;
          case "number":
            attrs.push({ name: attrName, type: "int" });
            break;
          case "object":
            if (value[attrName] === null) {
              console.log("null values are not accepted");
            }
            if (Array.isArray(value[attrName])) {
              attrs.push({ name: attrName, type: "List[Any]" });
            } else {
              const childClassName = `${className}${attrName}Class`;
              attrs.push({ name: attrName, type: childClassName });
              addClassTask(childClassName, value[attrName]);
            }
            break;
        }
      });
      classTasks.push({ className, attrs });
    }
    const { output } = variableMap[page.name];
    const outputRoutePath = path.resolve(
      paths.controllers,
      "routes",
      page.route.replace(/^([\/]*)/, ""),
      "atri.py"
    );
    const variableNames = Object.keys(output.vars);
    variableNames.forEach((variableName) => {
      const variable = output.vars[variableName];
      const className = `${variableName}Class`;
      addClassTask(className, variable.value);
      varClassMap[variableName] = className;
    });
    const importStatements = [
      "import json",
      "from typing import List, Any",
    ].join("\n");
    const classStatements = classTasks
      .map((classTask) => {
        const { className, attrs } = classTask;
        const attrStatements = attrs
          .map((attr) => {
            // if type is not str | int | bool then it's a class
            const typePrefix =
              attr.type === "str" || attr.type === "int" || attr.type === "bool"
                ? ""
                : "Atri.__";
            return `\t\t\tself.${attr.name}: ${typePrefix}${attr.type} = state["${attr.name}"]`;
          })
          .join("\n");
        const initBody = attrs.length === 0 ? "\t\t\tpass" : attrStatements;
        return `\tclass __${className}:\n\t\tdef __init__(self, state):\n${initBody}`;
      })
      .join("\n");
    const AtriClassInitBody =
      Object.keys(varClassMap)
        .map((varName) => {
          const className = varClassMap[varName];
          return `\t\tself.${varName} = self.__${className}(state["${varName}"])`;
        })
        .join("\n") || "\t\tpass";
    const AtriClassInitDef = `\tdef __init__(self, state: Any):\n${AtriClassInitBody}`;
    const AtriClassDef = `class Atri:\n${AtriClassInitDef}\n${classStatements}`;
    const newText = importStatements + "\n" + AtriClassDef;
    if (!fs.existsSync(path.dirname(outputRoutePath))) {
      fs.mkdirSync(path.dirname(outputRoutePath), { recursive: true });
    }
    fs.writeFileSync(outputRoutePath, newText);
  }
  function flushAtriPyFiles() {
    pages.forEach((page) => {
      flushAtriPyFile(page);
    });
  }
  function copyTemplate() {
    const files = getFiles(paths.pythonAppTemplate);
    files.forEach((file) => {
      const dirname = path.dirname(file);
      const relativeDirname = path.relative(paths.pythonAppTemplate, dirname);
      const destDirname = path.resolve(paths.controllers, relativeDirname);
      const relativeFilename = path.relative(paths.pythonAppTemplate, file);
      const destFilename = path.resolve(paths.controllers, relativeFilename);
      if (!fs.existsSync(destDirname)) {
        fs.mkdirSync(destDirname, { recursive: true });
      }
      fs.writeFileSync(destFilename, fs.readFileSync(file));
    });
  }
  // CAUTION: This will overridde existing main.py file
  function createMainPyFile(page: { name: string; route: string }) {
    const outputRouteMainPyPath = path.resolve(
      paths.controllers,
      "routes",
      page.route.replace(/^([\/]*)/, ""),
      "main.py"
    );
    if (!fs.existsSync(path.dirname(outputRouteMainPyPath))) {
      fs.mkdirSync(path.dirname(outputRouteMainPyPath));
    }
    fs.writeFileSync(
      outputRouteMainPyPath,
      fs.readFileSync(routeMainPyTemplatePath)
    );
  }
  function mainPyFileExists(page: { name: string; route: string }) {
    const outputRouteMainPyPath = path.resolve(
      paths.controllers,
      "routes",
      page.route.replace(/^([\/]*)/, ""),
      "main.py"
    );
    if (fs.existsSync(outputRouteMainPyPath)) {
      return true;
    }
    return false;
  }
  function createMainPyRecursively(page: { name: string; route: string }) {
    const routeSplits = page.route.split("/");
    for (let i = routeSplits.length; i > 0; i--) {
      const currRoute = "/" + routeSplits.slice(0, i).join("/");
      if (!mainPyFileExists({ name: page.name, route: currRoute })) {
        createMainPyFile({ name: page.name, route: currRoute });
      }
    }
  }
  // CAUTION: This will overridde existing main.py file
  function createInitPyFile(page: { name: string; route: string }) {
    const outputRouteInitPyPath = path.resolve(
      paths.controllers,
      "routes",
      page.route.replace(/^([\/]*)/, ""),
      "__init__.py"
    );
    if (!fs.existsSync(path.dirname(outputRouteInitPyPath))) {
      fs.mkdirSync(path.dirname(outputRouteInitPyPath));
    }
    fs.writeFileSync(outputRouteInitPyPath, "");
  }
  function initPyFileExists(page: { name: string; route: string }) {
    const outputRouteMainPyPath = path.resolve(
      paths.controllers,
      "routes",
      page.route.replace(/^([\/]*)/, ""),
      "__init__.py"
    );
    if (fs.existsSync(outputRouteMainPyPath)) {
      return true;
    }
    return false;
  }
  function createInitPyRecursively(page: { name: string; route: string }) {
    const routeSplits = page.route.split("/");
    for (let i = routeSplits.length; i > 0; i--) {
      const currRoute = "/" + routeSplits.slice(0, i).join("/");
      if (!initPyFileExists({ name: page.name, route: currRoute })) {
        createInitPyFile({ name: page.name, route: currRoute });
      }
    }
  }
  return {
    addVariables,
    flushAtriPyFiles,
    copyTemplate,
    createMainPyFile,
    mainPyFileExists,
    createMainPyRecursively,
    createInitPyFile,
    initPyFileExists,
    createInitPyRecursively,
  };
}
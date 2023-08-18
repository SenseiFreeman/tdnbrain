import papaparse from "papaparse";
import brain from "brainjs";

function preventEventDefault(e) {
    e.preventDefault();
}

function readFileAsText(file) {
    return new Promise(function (resolve, reject) {
        let reader = new FileReader();

        reader.onload = function () {
            resolve(reader.result);
        };

        reader.readAsText(file);
    });
}

document.documentElement.addEventListener("dragover", preventEventDefault);
document.documentElement.addEventListener("drop", preventEventDefault);

let data = null;
let net = null;
let dataZone = document.querySelector("#data-drop");
let inputZone = document.querySelectorAll("#input");
let outputZone = document.querySelectorAll("#output");
let ui = {};

for (let el of document.querySelectorAll("button[id], input[id], select[id], textarea[id")) ui[el.id] = el;

dataZone.addEventListener("drop", async function (e) {
    data = null;

    try {
        let file = e.dataTransfer.items[0].getAsFile();

        if (file) {
            let content = await readFileAsText(file);
            let parsed = papaparse.parse(content);

            let inputColumns = {};
            let outputColumns = {};

            let headers = parsed.data[0];

            if (headers.length < 2) throw new Error("Less then 2 columns");

            for (let i = 0; i < headers.length; i++) {
                let header = headers[i];
                let host = null;

                if (header[0] == "i") host = inputColumns;
                if (header[0] == "o") host = outputColumns;

                if (host) {
                    if (header in host) throw new Error("Duplicated header found");

                    host[header] = i;
                }
            }

            let inputKeys = Object.keys(inputColumns);
            let outputKeys = Object.keys(outputColumns);

            if (!inputKeys.length || !outputKeys.length) throw new Error("Invalid input / output columns count");

            let results = [];

            for (let i = 1; i < parsed.data.length; i++) {
                let row = parsed.data[i];
                let piece = { input: {}, output: {} };

                for (let colname in inputColumns) {
                    let val = +row[inputColumns[colname]];

                    if (!Number.isFinite(val)) throw new Error("Invalid value found");

                    piece.input[colname] = val;
                }

                for (let colname in outputColumns) {
                    let val = +row[outputColumns[colname]];

                    if (val !== 0 && val !== 1) throw new Error("Invalid value found");

                    piece.output[colname] = val;
                }

                results.push(piece);
            }

            data = { inputKeys, outputKeys, sample: results };
        }
    } catch (exc) {
        dataZone.textContent = exc.message;
    }

    dataZone.textContent = "Data loaded";
});

ui.train.addEventListener("click", function () {
    try {
        if (!data) throw new Error("Data not loaded");

        let hiddenLayers = JSON.parse(ui.layers.value);
        let activation = ui.activation.value;
        let iterations = +ui.iterations.value;
        let errorThresh = +ui.error.value;
        let learningRate = +ui.rate.value;
        let momentum = +ui.momentum.value;

        for (let neurons of hiddenLayers) if (!Number.isSafeInteger(neurons) || neurons < 1) throw new Error("Invalid number of neurons");

        if (activation !== "sigmoid" && activation !== "tanh" && activation !== "relu") throw new Error("Invalid activation function");

        if (!Number.isSafeInteger(iterations) || iterations < 1) throw new Error("Invalud iteration number");

        for (let [name, val] of [
            ["error threshold", errorThresh],
            ["learning rate", learningRate],
            ["momentum", momentum],
        ])
            if (!Number.isFinite(val) || val < 0 || val > 1) throw new Error(`Invalid ${name} value`);

        let netConfig = { binaryThresh: 0.5, hiddenLayers, activation };
        let trainConfig = { errorThresh, learningRate, momentum };

        net = null;

        inputZone.innerHTML = "";
        outputZone.innerHTML = "";

        ui.train.disabled = true;
        ui.train.textContent = "Training";
        ui.result.textContent = "";

        let candidate = new brain.NeuralNetwork(netConfig);

        candidate.train(data.sample, trainConfig);

        net = candidate;

        ui.train.textContent = "Train";
        ui.train.disabled = false;

        ui.result.textContent = JSON.stringify(candidate.toJSON());
    } catch (exc) {
        alert(exc.message);
    }
});

import React, { useState } from "react";
import * as R from "ramda";
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Scatter,
  ComposedChart,
} from "recharts";
import * as tf from "@tensorflow/tfjs";

const CHART_WIDTH = 500;
const CHART_HEIGHT = 500;
const Y_MAX_DOMAIN = 50;
const X_MAX_DOMAIN = 25;
const DATALENGTH = 2;

interface dataType {
  x: number;
  y: number;
}

const startData: dataType[] = R.pipe(
  R.map((x: number) => ({
    x,
    y: getRandomIntInclusive(x, x + 5),
  }))
)(R.range(0, DATALENGTH));

function getRandomIntInclusive(min: number, max: number) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function linear(m: number, b: number) {
  return (x: number) => m * x + b;
}

/*
FORMULA:

sum((x - xmean) * (y - ymean)) / sum((x - xmean)^2)
*/
function linearRegression(input: { x: number; y: number }[]) {
  const xmean = R.pipe(
    R.map<dataType, number>(({ x }) => x),
    R.mean
  )(input);

  const ymean = R.pipe(
    R.map<dataType, number>(({ y }) => y),
    R.mean
  )(input);

  const num = R.pipe(
    R.map<dataType, number>(({ x, y }) => (x - xmean) * (y - ymean)),
    R.sum
  )(input);

  const den = R.pipe(
    R.map<dataType, number>(({ x, y }) => (x - xmean) * (x - xmean)),
    R.sum
  )(input);

  const m = num / den;
  const b = ymean - m * xmean;

  console.log(`REG: ${m} * x + ${b}`);

  return { m, b };

  // return [
  //   { x: 0, y: m * 0 + b },
  //   { x: DATALENGTH, y: m * DATALENGTH + b },
  // ];
}

function stochasticGradientLinearRegression(
  input: dataType[],
  setRegression: React.Dispatch<React.SetStateAction<dataType[]>>,
  learning_rate = 0.01,
  epochs = 1000
) {
  const result = R.reduce(
    ({ m, b }, epoch) => {
      console.log(epoch, ":", m, b);
      const result = R.reduce(
        ({ m, b }, { x, y }) => {
          // Guessing
          const guess = linear(m, b)(x);
          // Cost function
          const error = y - guess;
          return {
            m: m + error * x * learning_rate,
            b: b + error * learning_rate,
          };
        },
        { m, b }
      )(input);
      return result;
    },
    { m: 0, b: 0 }
  )(R.range(0, epochs));
  console.log("GRADIENT :", result);
  return result;
}

function tfLinearRegression(
  input: dataType[],
  learning_rate = 0.01,
  epochs = 1000
) {
  return tf.tidy(() => {
    const optimizer = tf.train.sgd(learning_rate);
    const xs = R.map(({ x }) => x, input);
    const ys = R.map(({ y }) => y, input);
    const m = tf.variable(tf.scalar(0));
    const b = tf.variable(tf.scalar(0));

    function predict(xs: number[]) {
      const tfxs = tf.tensor1d(xs);
      // y = mx + b
      const tfys = tfxs.mul(m).add(b);
      tfxs.dispose();
      return tfys;
    }

    function loss(pred: any, labels: any) {
      return pred.sub(labels).square().mean();
    }

    function train() {
      const tfys = tf.tensor1d(ys);
      const result = optimizer.minimize(() => loss(predict(xs), tfys), false, [
        m,
        b,
      ]);
      tfys.dispose();
      result?.dispose();
    }

    R.pipe(R.forEach(() => train()))(R.range(0, epochs));

    const result = { m: m.dataSync()[0], b: b.dataSync()[0] };
    console.log("TF :", result);
    m.dispose();
    b.dispose();
    optimizer.dispose();
    return result;
  });
}

interface ComponentProps {
  //Your component props
}

const App: React.FC<ComponentProps> = (props: ComponentProps) => {
  const [data, setData] = useState<dataType[]>(startData);
  const [epochs, setEpochs] = useState<number>(1000);
  const [learning_rate, setLearning] = useState<number>(0.01);
  const [regression, setRegression] = useState<dataType[]>([]);
  return (
    <>
      <div>Epochs</div>
      <input
        type="number"
        min={1}
        max={100000}
        value={epochs}
        onChange={(e) => setEpochs(parseInt(e.target.value))}
      />
      <div>Learning Rate</div>
      <input
        type="number"
        min={0.0}
        max={1.0}
        step={0.00001}
        value={learning_rate}
        onChange={(e) => setLearning(parseFloat(e.target.value))}
      />
      <ComposedChart
        width={500}
        height={400}
        data={data}
        margin={{
          top: 20,
          right: 80,
          bottom: 20,
          left: 20,
        }}
      >
        <CartesianGrid stroke="#f5f5f5" />
        <Tooltip />

        <XAxis dataKey="x" type="number" />
        <YAxis type="number" domain={[0, 30]} />
        <Scatter dataKey="y" data={data} fill="grey" />
        {regression.length ? (
          <Line dataKey="y" data={regression} stroke="red" dot={false} />
        ) : null}
      </ComposedChart>
      <button
        onClick={() => {
          console.log(data);
          console.log("Active tensors :", tf.memory().numTensors);
        }}
      >
        Log
      </button>
      <button
        onClick={() => {
          if (data.length > 1) {
            const result = linearRegression(data);
            setRegression([
              { x: 0, y: result.m * 0 + result.b },
              { x: DATALENGTH, y: result.m * DATALENGTH + result.b },
            ]);
          }
        }}
      >
        Linear Regression Predict
      </button>
      <button
        onClick={() => {
          if (data.length > 1) {
            const result = stochasticGradientLinearRegression(
              data,
              setRegression,
              learning_rate,
              epochs
            );
            setRegression([
              { x: 0, y: result.m * 0 + result.b },
              { x: DATALENGTH, y: result.m * DATALENGTH + result.b },
            ]);
          }
        }}
      >
        Stochastic Gradient Descent Linear Regression Predict
      </button>
      <button
        onClick={() => {
          if (data.length > 1) {
            const result = tfLinearRegression(data, learning_rate, epochs);
            setRegression([
              { x: 0, y: result.m * 0 + result.b },
              { x: DATALENGTH, y: result.m * DATALENGTH + result.b },
            ]);
          }
        }}
      >
        TensorFlow Linear Regression Predict
      </button>
    </>
  );
};

export default App;

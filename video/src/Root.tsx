import React from "react";
import { Composition } from "remotion";
import { Intro } from "./Intro";
import { Demo } from "./Demo";
import { Arch } from "./Arch";
import { Close } from "./Close";
import { Thumb } from "./Thumb";

export const Root: React.FC = () => (
  <>
    <Composition id="Intro" component={Intro} durationInFrames={540} fps={30} width={1920} height={1080} />
    <Composition id="Demo" component={Demo} durationInFrames={3780} fps={30} width={1920} height={1080} />
    <Composition id="Arch" component={Arch} durationInFrames={1050} fps={30} width={1920} height={1080} />
    <Composition id="Close" component={Close} durationInFrames={270} fps={30} width={1920} height={1080} />
    <Composition id="Thumb" component={Thumb} durationInFrames={1} fps={30} width={1280} height={720} />
  </>
);

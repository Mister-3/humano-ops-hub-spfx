import * as React from 'react';
import IniciativasMejorasView, { type IIniciativasMejorasViewProps } from './IniciativasMejorasView';

export type IMejorasViewProps = IIniciativasMejorasViewProps;

export const MejorasView: React.FC<IMejorasViewProps> = (props) => {
  return <IniciativasMejorasView {...props} />;
};

export default MejorasView;

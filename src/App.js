import React, { Component } from 'react';
import * as d3 from 'd3';
import axios from 'axios';

class Visualization extends Component {
  constructor(props) {
    super(props);
    this.state = {
      datapoints: [],
      coordinates: [],
      finishLoading: false
    }
    this.loadData = this.loadData.bind(this);
    this.drawViz = this.drawViz.bind(this);
  }

  componentDidMount() {
    this.loadData();
  }

  componentDidUpdate() {
    if(this.state.finishLoading) this.drawViz();
  }

  loadData() {
    axios.get('https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/master/Landmark/Public_Art/LANDMARK_PublicArt.geojson')
    .then(res => {
      const data = JSON.parse(JSON.stringify(res.data));
      const dataLen = data.features.length;
      var coordinates = [];
      for(var i = 0; i < dataLen; i++) {
        var newdatapoints = this.state.datapoints.concat(data.features[i]);
        var x = ( data.features[i].geometry.coordinates[0] + 71.15398900022316 ) * 1080 / ( -71.07509999992466 + 71.15398900022316 );
        var y = ( data.features[i].geometry.coordinates[1] - 42.399699999628915 ) * 600 / (42.35560000021253 - 42.399699999628915 );
        var coord = [x, y];
        coordinates.push(coord);
        this.setState({datapoints: newdatapoints});
      }
      this.setState({coordinates: coordinates});
      this.setState({finishLoading: true});
    });
  }

  drawViz() {
    console.log('drawing viz...');
    const svg = d3.select('body').append('svg')
    .attr('width', this.props.width)
    .attr('height', this.props.height);

    svg.selectAll('rect')
      .data(this.state.coordinates)
      .enter()
      .append('rect')
      .attr('x', (d, i) => d[0])
      .attr('y', (d, i) => d[1])
      .attr('width', 3)
      .attr('height', 3)
      .attr('fill', 'green');

    svg.selectAll('text')
      .data(this.state.datapoints)
      .enter()
      .append('text')
      .text((d, i) => d.id)
      .attr('x', (d, i) => (d.geometry.coordinates[0] + 71.15398900022316 ) * 1080 / ( -71.07509999992466 + 71.15398900022316 ) - 5)
      .attr('y', (d, i) => (d.geometry.coordinates[1] - 42.399699999628915 ) * 600 / (42.35560000021253 - 42.399699999628915 ) + 18);
  }

  render() {
    return <div />;
  }
}

class App extends Component {
  render() {
    return (
      <div className="App">
        <Visualization width={1080} height={600} />
      </div>
    );
  }
}

export default App;

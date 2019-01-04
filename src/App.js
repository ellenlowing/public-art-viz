import React, { Component } from 'react';
import * as d3 from 'd3';
import axios from 'axios';
import Emoji from 'react-emoji-render';

function rgbToHex(r, g, b) {
  if (r > 255 || g > 255 || b > 255)
    throw "Invalid color component";
  return ((r << 16) | (g << 8) | b).toString(16);
}

function importAll(r) {
  let images = {};
  r.keys().map((item, index) => { images[item.replace('./', '')] = r(item); });
  return images;
}

const images = importAll(require.context('../dist/img', false, /\.(png|jpe?g|svg)$/));
const textures = importAll(require.context('../dist/material', false, /\.(png|jpe?g|svg)$/));
const imageKeys = Object.keys(images);
const textureKeys = Object.keys(textures);
var fullCoordinates = [];

class Visualization extends Component {
  constructor(props) {
    super(props);
    this.state = {
      rawData: [],
      coordinates: [],
      materials: [],
      finishLoading: false,
      finishLoadingImage: false,
      imgWidth: 0,
      imgHeight: 0,
      selectedId: -1,
      pixels: [],
      exponent: 0,
      switches: {sculpture: true, electronic: true, mural: true, mosaic: true}
    }
    this.startTimer = this.startTimer.bind(this);
    this.loadData = this.loadData.bind(this);
    this.loadImage = this.loadImage.bind(this);
    this.clearImage = this.clearImage.bind(this);
    this.drawMap = this.drawMap.bind(this);
    this.drawImage = this.drawImage.bind(this);
    this.viewHistory = this.viewHistory.bind(this);
    this.onImageMouseDown = this.onImageMouseDown.bind(this);
    this.onImageMouseUp = this.onImageMouseUp.bind(this);
    this.sortCoords = this.sortCoords.bind(this);
    this.updateNodes = this.updateNodes.bind(this);
    this.onResize = this.onResize.bind(this);
  }

  /** Initialization **/
  componentDidMount() {
    // Event listeners for toggle switches
    var switches = document.getElementsByClassName('switch-input');
    for(var i = 0; i < switches.length; i++) {
      var elem = switches[i];
      elem.checked = true;
      elem.addEventListener('change', (e) => {
        var id = e.target.id.substr(0, e.target.id.indexOf('-'));
        var tmp = this.state.switches;
        if (e.target.checked) {
          tmp[id] = true;
          this.updateNodes(id, 'add');
        } else {
          tmp[id] = false;
          this.updateNodes(id, 'rm');
        }
        this.setState({switches: tmp});
        this.clearImage('map');
        this.sortCoords();
        this.drawMap();
      });
    }

    // Event listener for view history button
    document.getElementsByClassName('time-btn')[0].addEventListener('click', (e) => {
      this.viewHistory();
    });

    // Processes data
    this.loadData();
    window.addEventListener('resize', this.onResize);

  }

  componentDidUpdate(prevProps, prevState) {
    if(this.state.finishLoading && this.state.finishLoading !== prevState.finishLoading) {
      // After raw data is parsed and stored in coordinates array
      this.sortCoords();
      this.drawMap();
    }
    if(this.state.finishLoadingImage && this.state.finishLoadingImage !== prevState.finishLoadingImage) {
      // After image is loaded
      this.startTimer();
    }
  }

  /** Sets up timer to display mosaic **/
  startTimer() {
    var timer = setInterval( () => {
      this.setState({exponent: this.state.exponent+1});
      this.drawImage();
      if( this.state.exponent > 3 ) {
        if(document.getElementsByClassName('mosaic-g') === null) document.getElementsByClassName('mosaic-g')[0].addEventListener('mousedown', this.onImageMouseDown);
        document.getElementsByClassName('img')[0].addEventListener('mouseup', this.onImageMouseUp);
        clearInterval(timer);
        this.setState({finishLoadingImage: false, selectedId: -1, exponent: 0, pixels: []});
        return;
      }
    }, 800);
  }

  /** Parses raw data **/
  loadData() {
    axios.get('https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/master/Landmark/Public_Art/LANDMARK_PublicArt.geojson')
    .then(res => {
      const data = JSON.parse(JSON.stringify(res.data));
      const dataLen = data.features.length;
      var coordinates = [];
      var materials = [];
      for(var i = 0; i < dataLen; i++) {
        var x = ( data.features[i].geometry.coordinates[0] + 71.15398900022316 ) * this.props.width * 0.75 / ( -71.07509999992466 + 71.15398900022316 );
        var y = ( data.features[i].geometry.coordinates[1] - 42.399699999628915 ) * this.props.height * 0.75 / (42.35560000021253 - 42.399699999628915 );
        var id = data.features[i].properties.ArtID;
        var category = data.features[i].properties.Category;
        var material = data.features[i].properties.Materials;
        var size = data.features[i].properties.Size;
        var title = data.features[i].properties.Title;
        var year = data.features[i].properties.Year;
        var firstName = data.features[i].properties.First_Name;
        var lastName = data.features[i].properties.Last_Name;
        var location = data.features[i].properties.Location;
        var about = data.features[i].properties.About;
        var coord = {x: x, y: y, id: id, category: category, material: material, size: size, title: title, year: year, firstName: firstName, lastName: lastName, location: location, about: about};
        coordinates.push(coord);
        if(!this.state.finishLoading) fullCoordinates.push(coord);
        if(!materials.includes(material)) materials.push(material);
      }
      this.setState({rawData: data.features});
      this.setState({coordinates: coordinates});
      this.setState({materials: materials});
      this.setState({finishLoading: true});
      Object.freeze(fullCoordinates); // fullCoordinates is constant
    });
  }

  /** Handler for toggle switches **/
  updateNodes(category, mode) {
    var coordinates = this.state.coordinates;
    if(mode === 'rm') {
      for(var i = 0; i < coordinates.length; i++) {
        var coordCategory = coordinates[i].category.toLowerCase();
        var n = coordCategory.indexOf(' ');
        if(n !== -1) coordCategory = coordCategory.substring(0, n);
        if(coordCategory.localeCompare(category) === 0) {
          coordinates.splice(i, 1);
          i -= 1;
        }
      }
    } else if (mode === 'add') {
      for(var i = 0; i < fullCoordinates.length; i++) {
        var coordCategory = fullCoordinates[i].category.toLowerCase();
        var n = coordCategory.indexOf(' ');
        if(n !== -1) coordCategory = coordCategory.substring(0, n);
        if(coordCategory.localeCompare(category) === 0) {
          coordinates.push(fullCoordinates[i]);
        }
      }
    }
    this.setState({coordinates: coordinates});
  }

  /** Loads image based on input file name and gets image data with canvas **/
  loadImage(inputSrc) {
    const ctx = this.refs.canvas.getContext('2d');
    var img = this.refs.img;
    img.src = inputSrc;
    img.onload = () => {

      /* Loading image data */
      var width = img.width;
      var height = img.height;
      img.style.display = 'none';
      var scale = (width < height) ? 600 / height : 600 / width;
      this.refs.canvas.width = width * scale;
      this.refs.canvas.height = height * scale;
      ctx.drawImage(img, 0, 0, width*scale, height*scale);
      ctx.scale(scale, scale);
      var imageData = ctx.getImageData(0, 0, width * scale, height * scale );
      var data = imageData.data;

      var pixels = [];
      for(let i = 0; i < data.length; i += 4) {
        pixels.push('#' + rgbToHex(data[i], data[i+1], data[i+2]));
      }
      ctx.clearRect(0, 0, width * scale, height * scale);
      this.setState({imgWidth: Math.round(width * scale)});
      this.setState({imgHeight: Math.round(height * scale)});
      this.setState({pixels: pixels});
      this.setState({finishLoadingImage: true});
    }
  }

  /** Draws map with coordinates array **/
  drawMap() {
    const svg = d3.select('svg.map');
    var count = 0;
    var map = svg.append('g')
                .selectAll('rect')
                .data(this.state.coordinates)
                .enter()
                .append('image')
                .attr('x', (d, i) => d.x)
                .attr('y', (d, i) => d.y)
                .attr('xlink:href', (d) => {
                  var material = d.material.replace(/\s/g, '').replace(/\//g, '').toLowerCase();
                  return textures[material + '.png'];
                })
                .attr('id', (d, i) => d.id)
                .attr('class', 'map-node')
                .attr('width', 50)
                .attr('height', 50)
                .on('click', (d, i) => {
                  this.clearImage('mosaic');
                  document.getElementsByClassName('mosaic-text')[0].style.display = 'none';
                  this.setState({finishLoadingImage: false, selectedId: -1, exponent: 0, pixels: []});
                  this.setState({selectedId: d.id});
                  this.refs.title.innerHTML = d.title;
                  this.refs.name.innerHTML = d.lastName + ', ' + d.firstName;
                  this.refs.address.innerHTML = d.location;
                  this.refs.year.innerHTML = d.year;
                  this.refs.material.innerHTML = d.material;
                  this.refs.about.innerHTML = d.about;
                  this.refs.info.style.color = '#2F4F4F';
                  this.refs.info.style.display = 'block';
                  // selects emoji to display inside the information section
                  var emojis = this.refs.emoji.children;
                  var material = d.material.replace(/\s/g, '').replace(/\//g, '').toLowerCase();
                  for(var i = 0; i < emojis.length; i++) {
                    if(emojis[i].id !== material) emojis[i].style.display = 'none';
                    else emojis[i].style.display = 'inline';
                  }
                  // finds whether image is jpg / png / gif
                  var img = (imageKeys.includes(d.id + '.jpg')) ? images[d.id + '.jpg'] : (imageKeys.includes(d.id + '.png')) ? images[d.id + '.png'] : (imageKeys.includes(d.id + '.gif')) ? images[d.id + '.gif'] : 0;
                  if(img !== 0) {
                    this.loadImage(img);
                  }
                  else {
                    document.getElementsByClassName('mosaic-text')[0].style.display = 'block'; // if there is no image of work
                  }
                });
  }

  /** Draws mosaic based on this.state.exponent, which increments by 1 every 800 ms **/
  drawImage() {
    if(this.state.finishLoadingImage) {
      /* Define size of shape, which pixels to draw, and where to draw */
      var width = this.state.imgWidth;
      var height = this.state.imgHeight;
      var xsize = width / Math.pow(2, this.state.exponent);
      var ysize = height / Math.pow(2, this.state.exponent);
      var selectedPixels = [];
      for(var i = 0; i < Math.pow(4, this.state.exponent); i++) {
        var increment = 1 / Math.pow(2, this.state.exponent);
        var start = increment / 2;
        var row = Math.floor((start + increment * Math.floor(i % Math.pow(2, this.state.exponent))) * width);
        var col = Math.floor((start + increment * Math.floor(i / Math.pow(2, this.state.exponent))) * height);
        var index = row + col * width;
        selectedPixels.push( this.state.pixels[index] );
      }
      /* Draw pixels */
      const svg = d3.select('svg.mosaic');
      d3.selectAll('svg.mosaic > *').remove();
        svg.append('g')
          .attr('class', 'mosaic-g')
          .selectAll('rect')
          .data(selectedPixels)
          .enter()
          .append('rect')
          .attr('x', (d, i) => Math.floor(i % Math.pow(2, this.state.exponent)) * xsize + (600-width))
          .attr('y', (d, i) => Math.floor(i / Math.pow(2, this.state.exponent)) * ysize)
          .attr('width', xsize)
          .attr('height', ysize)
          .attr('fill', (d, i) => d);
      console.log('finish drawing');
    }
  }

  /** Handler for mousedown on mosaic -- shows description and full image **/
  onImageMouseDown(e) {
    var img = document.getElementsByClassName('img')[0];
    img.style.width = this.state.imgWidth + 'px';
    img.style.height = this.state.imgHeight + 'px';
    img.style.display = 'block';
    var about = document.getElementsByClassName('about')[0];
    if(about.innerHTML !== 'undefined') {
      about.style.display = 'block';
      about.style.top = e.clientY + 'px';
      about.style.right = window.innerWidth - e.clientX + 'px';
    }
  }

  /** Handler for mouseup on mosaic -- hides description **/
  onImageMouseUp() {
    document.getElementsByClassName('img')[0].style.display = 'none';
    document.getElementsByClassName('about')[0].style.display = 'none';
  }

  sortCoords() {
    this.state.coordinates.sort( function(a, b) {
      return (a.year > b.year) ? 1 : ((b.year > a.year) ? -1 : 0);
    });
  }

  /** Animates timeline of works **/
  viewHistory() {
    // hiding all nodes
    var nodes = document.getElementsByClassName('map-node');
    for(var i = 0; i < nodes.length; i++) {
      nodes[i].style.display = 'none';
    }

    // disables toggle switches
    var switches = document.getElementsByClassName('switch-input');
    for(var i = 0; i < switches.length; i++) {
      switches[i].disabled = true;
    }

    // displaying one node every 50ms
    var it = 0;
    var timer = setInterval( () => {
      nodes[it].style.display = 'block';
      it++;
      if(it === nodes.length) {
        clearInterval(timer);
        // re-enabling toggle switches
        for(var i = 0; i < switches.length; i++) {
          switches[i].disabled = false;
        }
      }
    }, 50);
  }

  /** Helper function that clears svg **/
  clearImage(className) {
    d3.selectAll('svg.' + className + '> *').remove();
  }

  /** Resize handler, but not handles all elements **/
  onResize() {
    this.clearImage('map');
    this.loadData();
    this.sortCoords();
    this.drawMap();
  }

  render() {
    return ( <div>
              <img ref='img' className='img' draggable='false'/ >
              <svg className='map'/>
              <svg className='mosaic'/>
              <Emoji text='no image :('className='mosaic-text box'/>
              <div className='ui'>
                <div className='switches box'>
                  <div className='switch-block'>
                    <label className='switch'>
                      <input className='switch-input' id='sculpture-switch' type='checkbox'/ >
                      <span className='slider round'></span>
                    </label>
                    <label className='switch'>
                      <input className='switch-input' id='electronic-switch' type='checkbox'/ >
                      <span className='slider round'></span>
                    </label>
                    <label className='switch'>
                      <input className='switch-input' id='mural-switch' type='checkbox'/ >
                      <span className='slider round'></span>
                    </label>
                    <label className='switch'>
                      <input className='switch-input' id='mosaic-switch' type='checkbox'/ >
                      <span className='slider round'></span>
                    </label>
                  </div>
                  <div className='text-block'>
                    <div className='slider-text'>sculpture</div>
                    <div className='slider-text'>electronic media</div>
                    <div className='slider-text'>mural</div>
                    <div className='slider-text'>mosaic</div>
                  </div>
                </div>
                <div>
                  <input className='time-btn box' type='button' value='View history!'/>
                </div>
              </div>
              <div className='info box' ref='info'>
                <div className='info-container title-container'>
                  <div className='title info-content' ref='title'>Click on nodes on map to view works' details!</div>
                  <div className='name info-content' ref='name'></div>
                </div>
                <div className='info-container'>
                  <div className='material info-content'>
                    <span ref='material'/>
                    <span ref='emoji'>
                      <Emoji text=' 🗿' id='stone' className='emoji'/>
                      <Emoji text=' 🗽' id='steel' className='emoji'/>
                      <Emoji text=' 🗽' id='metal' className='emoji'/>
                      <Emoji text=' 🥉' id='bronze' className='emoji'/>
                      <Emoji text=' 🦄' id='stainedglass,mixedmedia' className='emoji'/>
                      <Emoji text=' 🦄' id='mixedmediainstallation' className='emoji'/>
                      <Emoji text=' 🦄' id='mixedmedia' className='emoji'/>
                      <Emoji text=' ⚰️' id='wood' className='emoji'/>
                      <Emoji text=' 🏺' id='ceramic' className='emoji'/>
                      <Emoji text=' 🔶' id='stainedglass' className='emoji'/>
                      <Emoji text=' 🔶' id='stainedglasszinc' className='emoji'/>
                      <Emoji text=' 🔶' id='glasstiles' className='emoji'/>
                      <Emoji text=' 🔶' id='glasstilemosaic' className='emoji'/>
                      <Emoji text=' 🏯' id='masonary' className='emoji'/>
                      <Emoji text=' 🎞️' id='movingimage' className='emoji'/>
                      <Emoji text=' 🛢️' id='paintedaluminium' className='emoji'/>
                      <Emoji text=' 🏛' id='concrete' className='emoji'/>
                      <Emoji text=' ◻️' id='ceramicfloorpiece' className='emoji'/>
                      <Emoji text=' ◻️' id='ceramictiles' className='emoji'/>
                      <Emoji text=' ◻️' id='steel,cermaictiles' className='emoji'/>
                      <Emoji text=' ◻️' id='tiles' className='emoji'/>
                      <Emoji text=' 🖱' id='foam,fiberglass' className='emoji'/>
                      <Emoji text=' 🖼' id='painting' className='emoji'/>
                      <Emoji text=' 🖼' id='paintings' className='emoji'/>
                      <Emoji text=' 🖼' id='fresco' className='emoji'/>
                      <Emoji text=' 🚦' id='lightinginstallation' className='emoji'/>
                      <Emoji text=' 🚦' id='ledlights' className='emoji'/>
                    </span>
                  </div>
                  <div className='year info-content' ref='year'></div>
                  <div className='address info-content' ref='address'></div>
                </div>
              </div>
              <div className='about box' ref='about'/>
              <canvas ref='canvas' className='canvas'/>
             </div> );
  }
}

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {width: 0, height: 0};
    this.updateWindowDimensions = this.updateWindowDimensions.bind(this);
  }

  componentDidMount() {
    this.updateWindowDimensions();
    window.addEventListener('resize', this.updateWindowDimensions);
  }

  updateWindowDimensions() {
    this.setState({width: window.innerWidth, height: window.innerHeight});
  }

  render() {
    return (
      <div className="App" width={this.state.width} height={this.state.height}>
        <Visualization width={this.state.width} height={this.state.height}/>
      </div>
    );
  }
}

export default App;

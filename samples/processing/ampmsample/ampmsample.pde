import oscP5.*;
import netP5.*;

OscP5 oscServer;
NetAddress ampmOsc; 

void setup() {
  oscServer = new OscP5(this, 3003); // set up OSC server
  ampmOsc = new NetAddress("127.0.0.1", 3002); // ampm OSC target
}

void draw() {
  oscServer.send(new OscMessage("/heart"), ampmOsc);
}
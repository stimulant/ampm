# Test script for AMPM
import time

from pythonosc import osc_message_builder
from pythonosc import udp_client

class App:
    def __init__(self):        
        self.initializeOSCClient()        
        self.mainLoop()        
        sys.exit(0)

    def initializeOSCClient(self):
        self.OSCClient = udp_client.SimpleUDPClient('127.0.0.1', 3002)

    def mainLoop(self):
        while True:            
            # Send osc message to ampm
            self.OSCClient.send_message("/heart", 1.0)

            time.sleep(0.2)
            
if __name__ == "__main__":
    App = App()


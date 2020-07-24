from __future__ import print_function
import time
from dual_g2_hpmd_rpi import motors, MAX_SPEED
import json
import socket
import os

socket_path = '/tmp/uv4l.socket'

print(socket_path)

try:
    os.unlink(socket_path)
except OSError:
    if os.path.exists(socket_path):
        raise

s = socket.socket(socket.AF_UNIX, socket.SOCK_SEQPACKET)

s.bind(socket_path)
s.listen(1)

# Define a custom exception to raise if a fault is detected.
class DriverFault(Exception):
    def __init__(self, driver_num):
        self.driver_num = driver_num

def raiseIfFault():
    if motors.motor1.getFault():
        raise DriverFault(1)
    if motors.motor2.getFault():
        raise DriverFault(2)

MAX_MESSAGE_SIZE = 1024

if __name__ == "__main__":
    while True:
        print('awaiting connection...')
        connection, client_address = s.accept()
        print('client_address %s' % client_address)
        try:
            motors.setSpeeds(0, 0)

            print('established connection with', client_address)

            while True:
                message = connection.recv(MAX_MESSAGE_SIZE)
                print('message: {}'.format(message))
                if not message:
                    break
                data = json.loads(message.decode('utf-8'))
  
                if data['commands'] == 'FORWARD':
                    motors.setSpeeds(MAX_SPEED/2.03, MAX_SPEED/2)
                elif data['commands'] == 'BACKWARD':
                    motors.setSpeeds(-MAX_SPEED/2.03, -MAX_SPEED/2)
                elif data['commands'] == 'LEFT':
                    motors.setSpeeds(MAX_SPEED/2, -MAX_SPEED/2)
                elif data['commands'] == 'RIGHT':
                    motors.setSpeeds(-MAX_SPEED/2, MAX_SPEED/2)   
                else:
                    motors.setSpeeds(0, 0)

            print('connection closed')

        except DriverFault as e:
            print("Driver %s fault!" % e.driver_num)

        finally:
            motors.forceStop()
            connection.close()

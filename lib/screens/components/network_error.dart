
import 'package:flutter/material.dart';

Widget showNetworkError(VoidCallback onclick) {
  return Center(
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Text("Ops! Aconteceu um erro"),
        ElevatedButton(onPressed: () {
          onclick();
        }, child: const Text("TENTAR NOVAMENTE"))
      ],
    ),
  );
}
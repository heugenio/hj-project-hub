import 'package:flutter/material.dart';

Widget MyCustomTextWithTitleAndDescription(String title, String value) {
  return RichText(
    text: TextSpan(
      children: <TextSpan>[
        TextSpan(
          text: title,
          style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.black),
        ),
        TextSpan(
          text: value,
          style: const TextStyle(fontWeight: FontWeight.normal, color: Colors.black),
        ),
      ],
    ),
  );
}

Widget MyCustomTextWithTitleAndDescriptionWithColor(String title, String value, Color color) {
  return RichText(
    text: TextSpan(
      children: <TextSpan>[
        TextSpan(
          text: title,
          style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.black),
        ),
        TextSpan(
          text: value,
          style: TextStyle(fontWeight: FontWeight.normal, color: color),
        ),
      ],
    ),
  );
}

